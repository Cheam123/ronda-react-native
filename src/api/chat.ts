import { api, toFormData, type LocalFile } from './client';

export interface ChatUpload {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  size: number;
  mime_type: string;
}

/** A task message (TaskController@getChatHistory). */
export interface ChatMessage {
  id: number;
  task_id: number;
  submitted_by: number;
  submit_by_name: string;
  message: string | null;
  created_at: string;
  date: string;
  reply_to: number | null;
  updated_at: string;
  document_uploads: ChatUpload[];
}

export async function fetchChat(taskId: number): Promise<ChatMessage[]> {
  const body = await api.get<{ data: { comments: ChatMessage[] } }>('tasks/chatHistory', { taskID: taskId });
  return body.data?.comments ?? [];
}

export async function sendChat(taskId: number, message: string, files: LocalFile[] = []): Promise<void> {
  const fields = { task_id: taskId, chat_message: message };
  await api.post('tasks/storeChat', files.length ? toFormData({ ...fields, files }) : fields, files.length ? 90 : 30);
}

export async function editChat(commentId: number, message: string): Promise<void> {
  await api.post('tasks/editChat', { commentID: commentId, message });
}

export async function deleteChat(commentId: number): Promise<void> {
  await api.post('tasks/deleteChat', { commentID: commentId });
}

export async function markChatRead(taskId: number): Promise<void> {
  await api.post('tasks/markChatAsRead', { id: taskId });
}

/** Messages may hold HTML from the web editor; show them as plain text. */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .trim();
}
