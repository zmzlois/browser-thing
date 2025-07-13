import * as dotenv from "dotenv";
import { WeaveClient } from "../utils/WeaveClient.js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

type LLMProviderType = 'openai' | 'anthropic';

const LLM_PROVIDER = 'openai' as LLMProviderType;

const openaiApiKey = process.env['OPENAI_API_KEY'] || process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY;

const MODEL_CONFIG = {
    openai: {
        modelName: "gpt-4.1-mini",
        apiKey: openaiApiKey,
    },
    anthropic: {
        modelName: "claude-3-5-sonnet",
        apiKey: anthropicApiKey,
    }
};

if (LLM_PROVIDER === 'openai' && !openaiApiKey) {
    throw new Error("[browser-thing] OPENAI_API_KEY is not set");
}

if (LLM_PROVIDER === 'anthropic' && !anthropicApiKey) {
    throw new Error("[browser-thing] ANTHROPIC_API_KEY is not set");
}

export function getLLMConfig() {
    const config = MODEL_CONFIG[LLM_PROVIDER as keyof typeof MODEL_CONFIG];
    return {
        provider: LLM_PROVIDER as LLMProviderType,
        modelName: config.modelName,
        apiKey: config.apiKey,
    };
}

export function createWeaveClient() {
    const config = MODEL_CONFIG[LLM_PROVIDER as keyof typeof MODEL_CONFIG];
    if (LLM_PROVIDER === 'anthropic') {
        return new WeaveClient({
            modelName: config.modelName,
            client: new Anthropic({
                apiKey: config.apiKey,
            }),
            provider: 'anthropic',
        });
    } else {
        return new WeaveClient({
            modelName: config.modelName,
            client: new OpenAI({
                apiKey: config.apiKey,
            }),
            provider: 'openai',
        });
    }
}
