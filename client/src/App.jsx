import { useState, useEffect } from "react";

const API = "";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authMsg, setAuthMsg] = useState("");
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [tips, setTips] = useState([]);
  const [tipsMsg, setTipsMsg] = useState("");

  // On mount, check if a session already exists
  useEffect(() => {
    fetch(`${API}/api/session/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch todos when user is logged in
  useEffect(() => {
    if (user) fetchTodos();
  }, [user]);

  async function fetchTodos() {
    const r = await fetch(`${API}/api/todos`, { credentials: "include" });
    const data = await r.json();
    if (r.ok) setTodos(data.todos);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMsg("");
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const r = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      setAuthMsg(data.error || "Something went wrong.");
      return;
    }
    if (authMode === "login") {
      setUser(data.user);
    } else {
      setAuthMsg("Registered! You can now log in.");
      setAuthMode("login");
    }
    setUsername("");
    setPassword("");
  }

  async function handleLogout() {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setTodos([]);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!newTodo.trim()) return;
    const r = await fetch(`${API}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: newTodo }),
    });
    if (r.ok) {
      setNewTodo("");
      fetchTodos();
    }
  }

  async function toggleTodo(id) {
    await fetch(`${API}/api/todos/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    fetchTodos();
  }

  async function deleteTodo(id) {
    await fetch(`${API}/api/todos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchTodos();
  }

  async function loadTips() {
    setTipsMsg("Loading…");
    const r = await fetch(`${API}/api/public/tips`);
    const data = await r.json();
    setTips(data.tips);
    const cc = r.headers.get("Cache-Control");
    setTipsMsg(`Cache-Control: ${cc}`);
  }

  if (loading) return <p style={s.center}>Loading…</p>;

  return (
    <div style={s.page}>
      <h1 style={s.title}>MERN Session & Cache Demo</h1>

      {/* ── Public tips ── */}
      <section style={s.card}>
        <h2>Public Tips (cached)</h2>
        <button style={s.btn} onClick={loadTips}>
          Load Tips
        </button>
        {tipsMsg && <p style={s.mono}>{tipsMsg}</p>}
        <ul>
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      {/* ── Auth ── */}
      {!user ? (
        <section style={s.card}>
          <h2>{authMode === "login" ? "Login" : "Register"}</h2>
          {authMsg && <p style={s.err}>{authMsg}</p>}
          <form onSubmit={handleAuth} style={s.form}>
            <input
              style={s.input}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              style={s.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={s.btn} type="submit">
              {authMode === "login" ? "Login" : "Register"}
            </button>
          </form>
          <p>
            {authMode === "login" ? (
              <>
                No account?{" "}
                <span style={s.link} onClick={() => setAuthMode("register")}>
                  Register
                </span>
              </>
            ) : (
              <>
                Have an account?{" "}
                <span style={s.link} onClick={() => setAuthMode("login")}>
                  Login
                </span>
              </>
            )}
          </p>
        </section>
      ) : (
        <>
          {/* ── Session info ── */}
          <section style={s.card}>
            <h2>Session</h2>
            <p>
              Logged in as <strong>{user.username}</strong> (role: {user.role})
            </p>
            <p style={s.mono}>
              /api/session/me → Cache-Control: no-store, no-cache…
            </p>
            <button style={{ ...s.btn, background: "#e55" }} onClick={handleLogout}>
              Logout
            </button>
          </section>

          {/* ── Todos ── */}
          <section style={s.card}>
            <h2>My Todos</h2>
            <form onSubmit={addTodo} style={s.form}>
              <input
                style={s.input}
                placeholder="New todo…"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
              />
              <button style={s.btn} type="submit">
                Add
              </button>
            </form>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {todos.map((t) => (
                <li key={t._id} style={s.todoItem}>
                  <span
                    style={{
                      textDecoration: t.completed ? "line-through" : "none",
                      cursor: "pointer",
                      flex: 1,
                    }}
                    onClick={() => toggleTodo(t._id)}
                  >
                    {t.text}
                  </span>
                  <button
                    style={{ ...s.btn, background: "#e55", padding: "2px 10px" }}
                    onClick={() => deleteTodo(t._id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: 600, margin: "0 auto", padding: "20px", fontFamily: "sans-serif" },
  title: { textAlign: "center" },
  card: { background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8, padding: 20, marginBottom: 20 },
  form: { display: "flex", gap: 8, marginBottom: 8 },
  input: { flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4 },
  btn: { padding: "8px 16px", background: "#0d6efd", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
  mono: { fontFamily: "monospace", fontSize: 13, color: "#555" },
  err: { color: "red" },
  link: { color: "#0d6efd", cursor: "pointer", textDecoration: "underline" },
  todoItem: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #eee" },
  center: { textAlign: "center", marginTop: 40 },
};

export default App;
