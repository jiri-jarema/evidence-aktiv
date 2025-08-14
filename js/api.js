import { getCurrentUser } from './state.js';

export async function fetchUsers() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/get-users', { headers: { 'Authorization': `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(await res.text());
  const { users } = await res.json();
  return users || {};
}

export async function upsertUser({ uid, email, role, odbor }) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/upsert-user', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ uid, email, role, odbor })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteUserByUid(uid) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/delete-user', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ uid })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
