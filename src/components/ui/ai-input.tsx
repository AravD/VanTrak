import React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Sparkle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/app/auth-context"

// Where the agent API lives. Falls back to local dev; set VITE_AGENT_API_URL for deploys.
const API_URL = import.meta.env.VITE_AGENT_API_URL ?? "http://localhost:8000"

type ChatMessage = { role: "user" | "assistant"; text: string }

// Smooth iOS-style easing for the morph.
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number]
const DOCK_H = 44 // height of the "Ask VanTrak" dock — stays constant so it never moves

export function MorphPanel() {
  const { session } = useAuth()
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [loading, setLoading] = React.useState(false)
  const [value, setValue] = React.useState("")

  const openPanel = React.useCallback(() => {
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])
  const closePanel = React.useCallback(() => setOpen(false), [])

  const send = React.useCallback(async () => {
    const text = value.trim()
    if (!text || loading) return

    const token = session?.access_token
    if (!token) {
      setMessages((m) => [...m, { role: "assistant", text: "Please sign in to use the assistant." }])
      return
    }

    setMessages((m) => [...m, { role: "user", text }])
    setValue("")
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      const reply = res.ok
        ? data.reply
        : `Error ${res.status}: ${data.detail ?? "request failed"}`
      setMessages((m) => [...m, { role: "assistant", text: reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Network error: ${String(err)}` }])
    } finally {
      setLoading(false)
    }
  }, [value, loading, session])

  // Keep the newest message in view.
  React.useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading, open])

  // Click outside to close.
  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open, closePanel])

  return (
    // The box itself is the fixed, bottom-pinned element. Growing its height keeps
    // the bottom edge pixel-locked, so the dock ("Ask VanTrak") never moves.
    // We only animate width/height/borderRadius, so motion leaves the
    // `-translate-x-1/2` centering transform untouched.
    <motion.div
      ref={wrapperRef}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col overflow-hidden border border-gray-200 bg-white shadow-lg"
      initial={false}
      animate={{
        width: open ? 340 : 150,
        height: open ? 340 : DOCK_H,
        borderRadius: open ? 16 : 22,
      }}
      transition={{ duration: 0.32, ease: EASE }}
    >
        {/* Chat content — revealed above the dock as the box grows. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-full flex-col"
              >
                {/* Header: icon + title on the left, Send on the top-right. */}
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-black">
                    <Sparkle className="h-4 w-4" />
                    <span>Assistant</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={send}
                    disabled={loading}
                  >
                    Send
                  </Button>
                </div>

                {/* Conversation. */}
                <div
                  ref={scrollRef}
                  className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[#FAFAFA] p-3"
                >
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "self-end bg-black whitespace-pre-wrap text-white"
                          : "self-start bg-white text-black shadow-sm ring-1 ring-gray-100"
                      )}
                    >
                      {m.role === "user" ? m.text : <MarkdownMessage text={m.text} />}
                    </div>
                  ))}
                  {loading && <div className="self-start px-1 text-xs text-gray-400">Thinking…</div>}
                </div>

                {/* Input. */}
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closePanel()
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Ask me anything..."
                  spellCheck={false}
                  disabled={loading}
                  className="h-14 w-full resize-none border-t border-gray-100 bg-white p-3 text-sm outline-0"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The dock — always the bottom of the box, always centered, never moves. */}
        <button
          type="button"
          onClick={() => (open ? closePanel() : openPanel())}
          className="flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium text-black"
          style={{ height: DOCK_H }}
        >
          <Sparkle className="h-4 w-4" />
          Ask VanTrak
        </button>
      </motion.div>
  )
}

// Renders the agent's Markdown reply cleanly inside the small chat bubble.
function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 marker:text-gray-400">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 marker:text-gray-400">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">{children}</code>
          ),
          // Headings would be oversized in a small bubble — render them as bold text.
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
