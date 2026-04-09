/**
 * 打分 Agent
 * 对生成的文章内容进行质量评分
 */

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface ScoreResult {
  score: number;
  feedback: string;
  passed: boolean;
}

const SCORE_THRESHOLD = 70;

const SCORE_SYSTEM_PROMPT = `你是一位深谙卡兹克（Khazix）爆款逻辑的内容质量评审专家。你需要对给定的公众号长文进行打分评估。

评分维度（必须根据 HKR 质检法与卡兹克写作特征，总分 100 分）：
1. **H (Happy) 趣味与悬念**（0-25分）：标题和开头是否让人好奇想点开？是否有荒诞事实或具体的悬念切入？
2. **K (Knowledge) 信息深度**（0-25分）：看完能学到新东西吗？是否自然掉落知识点而不是生硬科普？
3. **R (Resonance) 情绪共鸣**（0-25分）：是否戳中痛点？是否有私人视角连接和代入感？
4. **活人感与节奏**（0-15分）：是否口语化？有无故意打破的句子？是否像朋友在聊天？
5. **禁区检查**（0-10分）：是否完全避免了"首先其次最后"、"综上所述"等AI套话？标点符号是否符合规定（无冒号、无破折号）？

请严格按以下 JSON 格式返回：
{
  "score": 75,
  "feedback": "详细评分反馈，包括每个维度的得分和改进建议",
  "breakdown": {
    "happy": 20,
    "knowledge": 20,
    "resonance": 20,
    "human_rhythm": 10,
    "rule_check": 5
  }
}

不要返回 JSON 以外的内容。`;

export async function scoreContent(
  config: AIConfig,
  topic: string,
  content: string
): Promise<ScoreResult> {
  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: SCORE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `选题：${topic}\n\n文章内容：\n${content}`,
    },
  ]);

  const result = parseJSON(raw) as { score: number; feedback: string };
  const score = result.score || 0;
  return {
    score,
    feedback: result.feedback || "",
    passed: score >= SCORE_THRESHOLD,
  };
}
