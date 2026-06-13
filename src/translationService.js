export const LANGUAGE_MAP = {
  "auto": "Detect Language",
  "en": "English",
  "ar": "Arabic",
  "es": "Spanish",
  "fr": "French",
  "de": "German",
  "zh": "Chinese",
  "ja": "Japanese",
  "ko": "Korean",
  "ru": "Russian",
  "it": "Italian",
  "pt": "Portuguese",
  "hi": "Hindi",
  "tr": "Turkish",
  "nl": "Dutch",
  "pl": "Polish",
  "sv": "Swedish",
  "vi": "Vietnamese"
};

export async function detectLanguage(text) {
  if (!text || text.trim() === "") return "en";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[2] || "en";
  } catch (e) {
    console.error("Language detection failed, defaulting to 'en':", e);
    return "en";
  }
}

export async function translateWithGoogle(text, source, target) {
  if (!text || text.trim() === "") return "";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Translate error: ${res.statusText}`);
  const data = await res.json();
  
  // Parse response which can have multiple segments for paragraphs
  if (data && data[0]) {
    return data[0].map(item => item[0]).join("");
  }
  return "";
}

export async function translateWithAppsScript(text, source, target, scriptUrl) {
  if (!text || text.trim() === "") return "";
  if (!scriptUrl) throw new Error("Google Apps Script URL is not configured in settings.");

  let activeSource = source;
  if (source === "auto") {
    // Apps Script fails on empty or auto source, detect language first
    activeSource = await detectLanguage(text);
  }

  const url = `${scriptUrl}?q=${encodeURIComponent(text)}&source=${activeSource}&target=${target}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Apps Script error: ${res.statusText}`);
  const data = await res.text();
  return data;
}

export async function translateWithGemini(text, source, target, apiKey, model = "gemini-1.5-flash") {
  if (!text || text.trim() === "") return "";
  if (!apiKey) throw new Error("Gemini API key is not configured in settings.");

  let activeSource = source;
  if (source === "auto") {
    activeSource = await detectLanguage(text);
  }

  const sourceName = LANGUAGE_MAP[activeSource] || activeSource;
  const targetName = LANGUAGE_MAP[target] || target;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{
        text: `Translate the following text from ${sourceName} to ${targetName}. Provide ONLY the translation itself, exactly as it should appear, without any explanations, notes, preambles, or markdown formatting.\n\nText to translate:\n${text}`
      }]
    }]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error?.message || res.statusText;
    throw new Error(`Gemini API error: ${message}`);
  }

  const data = await res.json();
  const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultText) throw new Error("Invalid response format from Gemini API");

  return resultText.trim();
}
