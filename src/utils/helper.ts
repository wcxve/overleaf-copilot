import { LOCAL_STORAGE_KEY_API_KEY, LOCAL_STORAGE_KEY_BASE_URL, LOCAL_STORAGE_KEY_MODEL, LOCAL_STORAGE_KEY_OPTIONS, MAX_LENGTH_BEFORE_CURSOR, MAX_LENGTH_AFTER_CURSOR, MAX_LENGTH_SELECTION } from "../constants";
import { Options, TextContent } from "../types";

const Prefixes = ["```latex\n", "```latex", "```"];
const Suffixes = ["\n```", "```"];
const PromptVariableRegex = /\{\{[\w]*(selection|before|after)(\[([-]?\d*):([-]?\d*)\])?[\w]*\}\}/g;

export function postProcessToken(token: string | null) {
  if (!token) return '';


  for (const prefix of Prefixes) {
    if (token.startsWith(prefix)) {
      token = token.substring(prefix.length);
    }
  }

  for (const suffix of Suffixes) {
    if (token.endsWith(suffix)) {
      token = token.substring(0, token.length - suffix.length);
    }
  }

  return token;
}

export async function getOptions() {
  const data = await chrome.storage.local.get([LOCAL_STORAGE_KEY_OPTIONS, LOCAL_STORAGE_KEY_API_KEY, LOCAL_STORAGE_KEY_BASE_URL, LOCAL_STORAGE_KEY_MODEL]);
  const options = (data[LOCAL_STORAGE_KEY_OPTIONS] ?? {}) as Options;
  const toolbarActions = options.toolbarActions ?? [];

  // This is for backward compatibility. If the options are not found in the new format, try to get them from the old format.
  // It will be removed in the future.
  if (!options.apiKey && !!data[LOCAL_STORAGE_KEY_API_KEY]) options.apiKey = data[LOCAL_STORAGE_KEY_API_KEY];
  if (!options.apiBaseUrl && !!data[LOCAL_STORAGE_KEY_BASE_URL]) options.apiBaseUrl = data[LOCAL_STORAGE_KEY_BASE_URL];
  if (!options.model && !!data[LOCAL_STORAGE_KEY_MODEL]) options.model = data[LOCAL_STORAGE_KEY_MODEL];

  // By default, always add a rewrite action in the toolbar.
  if (toolbarActions.length === 0) toolbarActions.push({ name: '', prompt: '', icon: '', onClick: 'show_editor' });
  options.toolbarActions = toolbarActions;

  return options;
}

export function getQueryParams() {
  const queryString = window.location.search.substring(1); // Remove the leading '?'
  const params: Map<string, string> = new Map();

  queryString.split('&').forEach((param) => {
    const [key, value] = param.split('=');
    params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
  });

  return params;
}

export function renderPrompt(prompt: string, content: TextContent) {
  return prompt.replace(PromptVariableRegex, (_, variable_name, __, start, end) => {
    let variable = content[variable_name as keyof TextContent];
    if (variable_name === 'selection') {
      variable = variable.slice(0, MAX_LENGTH_SELECTION);
    } else if (variable_name === 'before') {
      variable = variable.slice(-MAX_LENGTH_BEFORE_CURSOR);
    } else if (variable_name === 'after') {
      variable = variable.slice(0, MAX_LENGTH_AFTER_CURSOR);
    }
    const sentences = variable.split(/\.\s+/g).filter(Boolean);
    let startIdx = parseInt(start);
    if (isNaN(startIdx)) startIdx = 0;
    let endIdx = parseInt(end);
    if (isNaN(endIdx)) endIdx = sentences.length;
    const slicedSentences = sentences.slice(startIdx, endIdx);
    const n = slicedSentences.length;

    if (n === 0) {
      return variable;
    }

    const startIdx2 = variable.indexOf(slicedSentences[0]);
    const lastSlicedSentence = slicedSentences[n - 1];

    if (lastSlicedSentence === sentences[sentences.length - 1]) {
      return variable.slice(startIdx2);
    } else {
      const endIdx2 = variable.indexOf(sentences[n]);
      return variable.slice(startIdx2, endIdx2);
    }
  });
}
