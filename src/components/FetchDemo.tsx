// app/components/FetchDemo.tsx

"use client";
import { useState } from "react";

export default function FetchDemo() {
  const [message, setMessage] = useState("");

  async function handleClick() {
    const res = await fetch("/api/hello");
    const data = await res.json();
    setMessage(data.message);
  }

  return (
    <div>
      <button onClick={handleClick}>Call API</button>
      <p>{message && `Server response: ${message}`}</p>
    </div>
  );
}
