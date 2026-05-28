const API_BASE = "/api";

let _token = localStorage.getItem("token");
let _user = JSON.parse(localStorage.getItem("user") || "null");

export function getUser() { return _user; }
export function getToken() { return _token; }
export function isLoggedIn() { return !!_token && !!_user; }
export function isAdmin() { return _user?.is_admin === true; }
export function isActive() { return _user?.is_active === true; }

export function setAuth(token, user) {
  _token = token;
  _user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  _token = null;
  _user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Fehler");
  return data;
}

export const api = {
  // Auth
  register: (nickname, password) => req("POST", "/auth/register", { nickname, password }),
  login:    (nickname, password) => req("POST", "/auth/login",    { nickname, password }),
  me:       ()                   => req("GET",  "/auth/me"),

  // Stickers
  stickers:    ()          => req("GET",    "/stickers"),
  myHave:      ()          => req("GET",    "/stickers/my/have"),
  myWant:      ()          => req("GET",    "/stickers/my/want"),
  setHaveQty:  (id, qty)   => req("PATCH",  `/stickers/my/have/${id}`, { quantity: qty }),
  addHave:     (id)        => req("PUT",    `/stickers/my/have/${id}`),
  removeHave:  (id)        => req("DELETE", `/stickers/my/have/${id}`),
  addWant:     (id)        => req("PUT",    `/stickers/my/want/${id}`),
  removeWant:  (id)        => req("DELETE", `/stickers/my/want/${id}`),
  bulkHave:    (add, remove) => req("POST", "/stickers/my/have/bulk", { add, remove }),
  bulkWant:    (add, remove) => req("POST", "/stickers/my/want/bulk", { add, remove }),

  // Trades
  trades:       ()                       => req("GET",  "/trades"),
  confirmTrade: (give_ids, receive_ids)  => req("POST", "/trades/confirm", { give_ids, receive_ids }),

  // Admin
  adminStats:      ()         => req("GET",    "/admin/stats"),
  securityLog:     ()         => req("GET",    "/admin/security-log"),
  adminUsers:      ()         => req("GET",    "/admin/users"),
  approveUser:     (id)       => req("POST",   `/admin/users/${id}/approve`),
  revokeUser:      (id)       => req("POST",   `/admin/users/${id}/revoke`),
  deleteUser:      (id)       => req("DELETE", `/admin/users/${id}`),
  makeAdmin:       (id)       => req("POST",   `/admin/users/${id}/make-admin`),
  adminStickers:   ()         => req("GET",    "/admin/stickers"),
  createSticker:   (data)     => req("POST",   "/admin/stickers", data),
  updateSticker:   (id, data) => req("PUT",    `/admin/stickers/${id}`, data),
  deleteSticker:   (id)       => req("DELETE", `/admin/stickers/${id}`),
};
