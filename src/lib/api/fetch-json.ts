export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return {} as T;
  }

  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!response.ok) {
      throw new Error(
        typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
          ? data.error
          : `Request failed (${response.status})`,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Request failed")) {
      throw error;
    }
    if (error instanceof SyntaxError || error instanceof Error) {
      const preview = text.replace(/\s+/g, " ").slice(0, 80);
      if (response.status === 504 || preview.includes("TIMEOUT")) {
        throw new Error(
          "This took too long to compute. Please try again in a moment.",
        );
      }
      throw new Error(
        preview.includes("An error occurred")
          ? "The server hit a temporary error. Please try again."
          : `Unexpected server response (${response.status})`,
      );
    }
    throw error;
  }
}
