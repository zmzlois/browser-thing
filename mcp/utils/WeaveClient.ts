/**
 * Welcome to the Stagehand custom LLM client!
 *
 * This is a client for models that are compatible with the OpenAI API and Anthropic API.
 * You can pass in an OpenAI instance or Anthropic instance to the client and it will work.
 */

import {
    type AvailableModel,
    type CreateChatCompletionOptions,
    CreateChatCompletionResponseError,
    LLMClient,
} from "@browserbasehq/stagehand";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
    ChatCompletion,
    ChatCompletionAssistantMessageParam,
    ChatCompletionContentPartImage,
    ChatCompletionContentPartText,
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import * as weave from 'weave';

function validateZodSchema(schema: z.ZodTypeAny, data: unknown) {
    try {
        schema.parse(data);
        return true;
    } catch {
        return false;
    }
}

type LLMProvider = 'openai' | 'anthropic';

export class WeaveClient extends LLMClient {
    private client: OpenAI | Anthropic;
    private provider: LLMProvider;

    constructor({
        modelName,
        client,
        provider
    }: {
        modelName: string;
        client: OpenAI | Anthropic;
        provider?: LLMProvider;
    }) {
        super(modelName as AvailableModel);
        this.client = client;
        this.modelName = modelName as AvailableModel;

        // Auto-detect provider if not specified
        if (provider) {
            this.provider = provider;
        } else {
            this.provider = client instanceof Anthropic ? 'anthropic' : 'openai';
        }
    }

    async weaveWrapper(body: ChatCompletionCreateParamsNonStreaming | Anthropic.Messages.MessageCreateParams) {
        let response = null;

        if (this.provider === 'anthropic') {
            const browsePage = async (body: Anthropic.Messages.MessageCreateParams) => {
                response = await (this.client as Anthropic).messages.create(body);
                const messageResponse = response as Anthropic.Messages.Message;
                return messageResponse.content[0]?.type === 'text' ? messageResponse.content[0].text : '';
            }
            const extractData = weave.op(browsePage);
            await extractData(body as Anthropic.Messages.MessageCreateParams);
        } else {
            const browsePage = async (body: ChatCompletionCreateParamsNonStreaming) => {
                response = await (this.client as OpenAI).chat.completions.create(body);
                return response.choices[0]!.message.content!;
            };
            const extractData = weave.op(browsePage);
            await extractData(body as ChatCompletionCreateParamsNonStreaming);
        }

        return response!;
    }

    private convertToAnthropicMessages(messages: any[]): Anthropic.Messages.MessageParam[] {
        const anthropicMessages: Anthropic.Messages.MessageParam[] = [];

        for (const message of messages) {
            if (message.role === 'system') {
                // Anthropic handles system messages differently - they're passed as system parameter
                continue;
            }

            if (Array.isArray(message.content)) {
                const content = message.content.map((part: any) => {
                    if (part.type === 'text') {
                        return { type: 'text', text: part.text };
                    } else if (part.type === 'image_url') {
                        // Convert image URL to Anthropic format
                        return {
                            type: 'image',
                            source: {
                                type: 'url',
                                url: part.image_url.url
                            }
                        };
                    }
                    return part;
                });

                anthropicMessages.push({
                    role: message.role === 'assistant' ? 'assistant' : 'user',
                    content
                });
            } else {
                anthropicMessages.push({
                    role: message.role === 'assistant' ? 'assistant' : 'user',
                    content: message.content
                });
            }
        }

        return anthropicMessages;
    }

    private getSystemMessage(messages: any[]): string | undefined {
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (systemMessage) {
            if (Array.isArray(systemMessage.content)) {
                return systemMessage.content
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join(' ');
            }
            return systemMessage.content;
        }
        return undefined;
    }

    async createChatCompletion<T = ChatCompletion>({
        options,
        retries = 3,
        logger,
    }: CreateChatCompletionOptions): Promise<T> {
        const { image, requestId, ...optionsWithoutImageAndRequestId } = options;

        if (image && this.provider === 'openai') {
            console.warn(
                "Image provided. Vision is not currently supported for openai in this implementation",
            );
        }

        logger({
            category: this.provider,
            message: "creating chat completion",
            level: 1,
            auxiliary: {
                options: {
                    value: JSON.stringify({
                        ...optionsWithoutImageAndRequestId,
                        requestId,
                    }),
                    type: "object",
                },
                modelName: {
                    value: this.modelName,
                    type: "string",
                },
                provider: {
                    value: this.provider,
                    type: "string",
                },
            },
        });

        if (this.provider === 'anthropic') {
            // Handle Anthropic-specific logic
            const anthropicMessages = this.convertToAnthropicMessages(options.messages);
            const systemMessage = this.getSystemMessage(options.messages);

            const body: Anthropic.Messages.MessageCreateParams = {
                model: this.modelName,
                messages: anthropicMessages,
                max_tokens: options.maxTokens || 4000,
                ...(systemMessage && { system: systemMessage }),
            };

            const response = await this.weaveWrapper(body);

            logger({
                category: "anthropic",
                message: "response",
                level: 1,
                auxiliary: {
                    response: {
                        value: JSON.stringify(response),
                        type: "object",
                    },
                    requestId: {
                        value: requestId!,
                        type: "string",
                    },
                },
            });

            const anthropicResponse = response as Anthropic.Messages.Message;
            const content = anthropicResponse.content[0]?.type === 'text' ? anthropicResponse.content[0].text : '';

            if (options.response_model) {
                if (!content) {
                    throw new CreateChatCompletionResponseError("No content in response");
                }
                const parsedData = JSON.parse(content);

                if (!validateZodSchema(options.response_model.schema, parsedData)) {
                    if (retries > 0) {
                        return this.createChatCompletion({
                            options,
                            logger,
                            retries: retries - 1,
                        });
                    }

                    throw new CreateChatCompletionResponseError("Invalid response schema");
                }

                return {
                    data: parsedData,
                    usage: {
                        prompt_tokens: anthropicResponse.usage?.input_tokens ?? 0,
                        completion_tokens: anthropicResponse.usage?.output_tokens ?? 0,
                        total_tokens: (anthropicResponse.usage?.input_tokens ?? 0) + (anthropicResponse.usage?.output_tokens ?? 0),
                    },
                } as T;
            }

            return {
                data: content,
                usage: {
                    prompt_tokens: anthropicResponse.usage?.input_tokens ?? 0,
                    completion_tokens: anthropicResponse.usage?.output_tokens ?? 0,
                    total_tokens: (anthropicResponse.usage?.input_tokens ?? 0) + (anthropicResponse.usage?.output_tokens ?? 0),
                },
            } as T;
        } else {
            // Handle OpenAI-specific logic (existing code)
            let responseFormat = undefined;
            if (options.response_model) {
                responseFormat = zodResponseFormat(
                    options.response_model.schema,
                    options.response_model.name,
                );
            }

            const { response_model, ...openaiOptions } = {
                ...optionsWithoutImageAndRequestId,
                model: this.modelName,
            };

            logger({
                category: "openai",
                message: "creating chat completion",
                level: 1,
                auxiliary: {
                    openaiOptions: {
                        value: JSON.stringify(openaiOptions),
                        type: "object",
                    },
                },
            });

            const formattedMessages: ChatCompletionMessageParam[] =
                options.messages.map((message) => {
                    if (Array.isArray(message.content)) {
                        const contentParts = message.content.map((content) => {
                            if ("image_url" in content) {
                                const imageContent: ChatCompletionContentPartImage = {
                                    image_url: {
                                        url: content.image_url!.url,
                                    },
                                    type: "image_url",
                                };
                                return imageContent;
                            } else {
                                const textContent: ChatCompletionContentPartText = {
                                    text: content.text!,
                                    type: "text",
                                };
                                return textContent;
                            }
                        });

                        if (message.role === "system") {
                            const formattedMessage: ChatCompletionSystemMessageParam = {
                                ...message,
                                role: "system",
                                content: contentParts.filter(
                                    (content): content is ChatCompletionContentPartText =>
                                        content.type === "text",
                                ),
                            };
                            return formattedMessage;
                        } else if (message.role === "user") {
                            const formattedMessage: ChatCompletionUserMessageParam = {
                                ...message,
                                role: "user",
                                content: contentParts,
                            };
                            return formattedMessage;
                        } else {
                            const formattedMessage: ChatCompletionAssistantMessageParam = {
                                ...message,
                                role: "assistant",
                                content: contentParts.filter(
                                    (content): content is ChatCompletionContentPartText =>
                                        content.type === "text",
                                ),
                            };
                            return formattedMessage;
                        }
                    }

                    const formattedMessage: ChatCompletionUserMessageParam = {
                        role: "user",
                        content: message.content,
                    };

                    return formattedMessage;
                });

            const body: ChatCompletionCreateParamsNonStreaming = {
                ...openaiOptions,
                model: this.modelName,
                messages: formattedMessages,
                response_format: responseFormat,
                stream: false,
                tools: options.tools?.map((tool) => ({
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters,
                    },
                    type: "function",
                })),
            };

            const response = await this.weaveWrapper(body);

            logger({
                category: "openai",
                message: "response",
                level: 1,
                auxiliary: {
                    response: {
                        value: JSON.stringify(response),
                        type: "object",
                    },
                    requestId: {
                        value: requestId!,
                        type: "string",
                    },
                },
            });

            const openaiResponse = response as ChatCompletion;

            if (options.response_model) {
                const extractedData = openaiResponse.choices[0]!.message.content;
                if (!extractedData) {
                    throw new CreateChatCompletionResponseError("No content in response");
                }
                const parsedData = JSON.parse(extractedData);

                if (!validateZodSchema(options.response_model.schema, parsedData)) {
                    if (retries > 0) {
                        return this.createChatCompletion({
                            options,
                            logger,
                            retries: retries - 1,
                        });
                    }

                    throw new CreateChatCompletionResponseError("Invalid response schema");
                }

                return {
                    data: parsedData,
                    usage: {
                        prompt_tokens: openaiResponse.usage?.prompt_tokens ?? 0,
                        completion_tokens: openaiResponse.usage?.completion_tokens ?? 0,
                        total_tokens: openaiResponse.usage?.total_tokens ?? 0,
                    },
                } as T;
            }

            return {
                data: openaiResponse.choices[0]!.message.content,
                usage: {
                    prompt_tokens: openaiResponse.usage?.prompt_tokens ?? 0,
                    completion_tokens: openaiResponse.usage?.completion_tokens ?? 0,
                    total_tokens: openaiResponse.usage?.total_tokens ?? 0,
                },
            } as T;
        }
    }
}