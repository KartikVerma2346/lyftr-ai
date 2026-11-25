
const API_URL = "http://localhost:8000";

export async function createChat() {
  const response = await fetch(`${API_URL}/chats`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not create chat");
  return response.json();
}

export async function getChats() {
  const response = await fetch(`${API_URL}/chats`);
  if (!response.ok) throw new Error("Could not load chats");
  return response.json();
}

export async function getChat(id: number) {
  const response = await fetch(`${API_URL}/chats/${id}`);
  if (!response.ok) throw new Error("Could not load conversation");
  return response.json();
}

export async function saveMessage(
  id: number,
  role: "user" | "assistant",
  content: string
) {
  const response = await fetch(`${API_URL}/chats/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
  if (!response.ok) throw new Error("Could not save message");
  return response.json();
}

export async function deleteChat(id: number) {
  const response = await fetch(`${API_URL}/chats/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Could not delete chat");
  return response.json();
}
