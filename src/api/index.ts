export async function checkLocalApi(params: {
  baseURL: string;
  apiKey?: string;
}): Promise<boolean> {
  try {
    const rawBaseURL = String(params.baseURL || "").replace(/\/+$/, "");
    if (!rawBaseURL) {
      return false;
    }
    const openAIBaseURL = /\/v1$/i.test(rawBaseURL)
      ? rawBaseURL
      : `${rawBaseURL}/v1`;
    const headers: Record<string, string> = {};
    if (params.apiKey) {
      headers.Authorization = `Bearer ${params.apiKey}`;
    }
    const response = await fetch(`${openAIBaseURL}/models`, { headers });
    return response.ok;
  } catch (error) {
    ztoolkit.log("checkLocalApi failed", error);
    return false;
  }
}

export default {
  checkLocalApi,
};
