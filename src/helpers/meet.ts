import { MEET_API_URL } from "../constants";

/** Create a new Google Meet space and return the meeting URI. */
export async function createMeetSpace(accessToken: string): Promise<string> {
  const res = await fetch(MEET_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meet API error (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { meetingUri: string };
  return data.meetingUri;
}
