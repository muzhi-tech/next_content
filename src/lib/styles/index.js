"use strict";
/**
 * 写作风格模板导出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsStyle = exports.lifestyleStyle = exports.businessStyle = exports.techStyle = exports.STYLE_LIST = exports.STYLES = void 0;
exports.getStyle = getStyle;
exports.buildUserPrompt = buildUserPrompt;
var tech_1 = require("./tech");
Object.defineProperty(exports, "techStyle", { enumerable: true, get: function () { return tech_1.techStyle; } });
var business_1 = require("./business");
Object.defineProperty(exports, "businessStyle", { enumerable: true, get: function () { return business_1.businessStyle; } });
var lifestyle_1 = require("./lifestyle");
Object.defineProperty(exports, "lifestyleStyle", { enumerable: true, get: function () { return lifestyle_1.lifestyleStyle; } });
var news_1 = require("./news");
Object.defineProperty(exports, "newsStyle", { enumerable: true, get: function () { return news_1.newsStyle; } });
exports.STYLES = {
    tech: tech_1.techStyle,
    business: business_1.businessStyle,
    lifestyle: lifestyle_1.lifestyleStyle,
    news: news_1.newsStyle,
};
exports.STYLE_LIST = Object.values(exports.STYLES);
function getStyle(id) {
    return exports.STYLES[id] || null;
}
function buildUserPrompt(style, topic, keywords, length) {
    var prompt = style.userPromptTemplate
        .replace("{topic}", topic);
    // 添加长度说明
    if (length) {
        var lengthMap = {
            short: "（短文，500-800字）",
            medium: "（中等长度，1000-1500字）",
            long: "（长文，2000-2500字）",
        };
        prompt = prompt.replace("{length_section}", lengthMap[length] || "");
    }
    else {
        prompt = prompt.replace("{length_section}", "（中等长度）");
    }
    // 添加关键词
    if (keywords && keywords.length > 0) {
        prompt = prompt.replace("{keywords_section}", "\n\n\u53C2\u8003\u5173\u952E\u8BCD\uFF1A".concat(keywords.join("、")));
    }
    else {
        prompt = prompt.replace("{keywords_section}", "");
    }
    return prompt;
}
