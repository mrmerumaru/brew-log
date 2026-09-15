import React from "react";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";

/**
 * Without this, a thrown render error unmounts the whole React tree and leaves
 * a blank white page with nothing in the UI to say what happened — which is
 * exactly what a `const` read before its declaration in BrewForm produced, and
 * it took a revert to isolate. Now the message lands on screen instead.
 *
 * Caveat worth knowing: boundaries catch errors thrown during render, in
 * lifecycle methods, and in constructors. They do NOT catch errors inside event
 * handlers or async callbacks — those need their own try/catch, which is why
 * handleSave and the share flow have theirs.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the component stack so the fallback can name the component that
    // threw, which is usually enough to find it without a debugger.
    this.setState({ stack: info?.componentStack ?? null });
    console.error("Unhandled render error:", error, info);
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{ background: TOKENS.paper, minHeight: "100vh" }}
        className="w-full flex justify-center py-10 px-4"
      >
        <div
          className="w-full max-w-[480px] rounded-sm px-6 py-8"
          style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}` }}
        >
          <h1
            className="text-[15px] mb-4"
            style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
          >
            Something went wrong
          </h1>

          <p
            className="mb-5 text-[14px]"
            style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.6 }}
          >
            The app hit an error it couldn't recover from. Nothing you'd already
            saved is affected — reloading usually clears it.
          </p>

          <p
            className="mb-5 p-3 rounded-sm text-[12px]"
            style={{
              fontFamily: MONO,
              color: TOKENS.red,
              background: TOKENS.paper,
              border: `1px solid ${TOKENS.rule}`,
              overflowWrap: "anywhere",
            }}
          >
            {error.name ? `${error.name}: ` : ""}
            {error.message || String(error)}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              background: TOKENS.green,
              color: TOKENS.card,
            }}
          >
            Reload
          </button>

          {stack && (
            <details className="mt-5">
              <summary
                className="text-[10px] uppercase tracking-[0.08em] cursor-pointer"
                style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
              >
                Where it happened
              </summary>
              <pre
                className="mt-2 text-[11px] whitespace-pre-wrap"
                style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
              >
                {stack.trim()}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
