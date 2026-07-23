'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { PressButton } from '@/components/Pressable';
import { ArrowIcon, MicIcon, PaperclipIcon } from '@/components/icons';
import { prefersReducedMotion } from '@/lib/spring';
import { useIsClient } from '@/lib/hooks';

export interface FileMeta {
  name: string;
  size: number;
}

export interface ObComposerHandle {
  /** drop an example into the field and focus it */
  fill(text: string): void;
}

interface Props {
  mode: 'text' | 'choice';
  placeholder: string;
  /** false while Allya is "thinking" — no double submits mid-thought */
  accepting: boolean;
  onSubmit: (value: string, files: FileMeta[]) => void;
  handleRef: RefObject<ObComposerHandle | null>;
}

const MAX_H = 132;

function fileSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function ObComposer({ mode, placeholder, accepting, onSubmit, handleRef }: Props) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // a dead control is worse than no control
  const isClient = useIsClient();
  const voiceSupported = isClient && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const baseText = useRef('');
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChoice = mode === 'choice';

  const autoGrow = useCallback(() => {
    const t = fieldRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, MAX_H)}px`;
  }, []);

  useImperativeHandle(handleRef, () => ({
    fill(text: string) {
      setValue(text);
      requestAnimationFrame(() => {
        autoGrow();
        fieldRef.current?.focus();
      });
    },
  }));

  useEffect(() => autoGrow(), [value, autoGrow]);

  /* The parent remounts this per question (keyed on the step), so the field,
     the attachments and the hint all start clean without an effect resetting
     them. All that's left is taking focus once the question has landed. */
  useEffect(() => {
    const id = setTimeout(
      () => {
        if (!isChoice) fieldRef.current?.focus();
      },
      prefersReducedMotion() ? 0 : 240,
    );
    return () => clearTimeout(id);
  }, [isChoice]);

  const flashHint = useCallback((msg: string, revertAfter = 3200) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(msg);
    if (revertAfter) hintTimer.current = setTimeout(() => setHint(null), revertAfter);
  }, []);

  const stopVoice = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    }
    setRecording(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(null);
  }, []);

  /* voice: the browser's own recogniser, dictating into the field. It never
     auto-submits — you read it back and press Enter. */
  const startVoice = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor || recording || isChoice) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    baseText.current = value ? value.replace(/\s*$/, ' ') : '';

    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      const next = baseText.current + text;
      setValue(next);
      if (e.results[e.results.length - 1].isFinal) baseText.current = next.replace(/\s*$/, ' ');
    };
    rec.onerror = (e) => {
      stopVoice();
      flashHint(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Voice needs mic access — type instead'
          : 'Voice didn’t catch that — type instead',
      );
    };
    rec.onend = () => stopVoice();

    try {
      rec.start();
    } catch {
      return;
    }
    recRef.current = rec;
    setRecording(true);
    flashHint('Listening — press the mic again to stop', 0);
  }, [recording, isChoice, value, stopVoice, flashHint]);

  useEffect(() => stopVoice, [stopVoice]);

  const submit = () => {
    if (!accepting || isChoice) return;
    const val = value.trim();
    if (!val) return;
    stopVoice();
    onSubmit(val, files);
    setValue('');
    setFiles([]);
  };

  /* documents are staged as pills and recorded by filename only. Contents
     are deliberately not parsed — folding raw file text into the answer
     would pollute the goal/label parsing that reads the answer directly. */
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => {
      const next = [...prev];
      Array.from(list).forEach((f) => {
        if (!next.some((p) => p.name === f.name && p.size === f.size)) next.push({ name: f.name, size: f.size });
      });
      return next;
    });
  };

  return (
    <div className={`composer ob-composer${isChoice ? ' is-locked' : ''}`}>
      {files.length ? (
        <div className="ob-attachments">
          {files.map((f, i) => (
            <span className="ob-attach-pill" key={`${f.name}-${f.size}`}>
              <span className="ap-name">{f.name}</span>
              <span className="ap-size">{fileSize(f.size)}</span>
              <button
                type="button"
                className="ap-x"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="field">
        <textarea
          ref={fieldRef}
          rows={1}
          autoComplete="off"
          spellCheck
          // readOnly rather than disabled: disabled blurs the field, which on
          // mobile dismisses the keyboard and re-pops it on the next step
          readOnly={isChoice}
          placeholder={isChoice ? 'Pick one above' : placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            e.preventDefault();
            submit();
          }}
        />
        <PressButton
          type="button"
          className="ob-icon"
          title="Attach a document"
          aria-label="Attach a document"
          pressScale={0.92}
          onClick={() => fileRef.current?.click()}
        >
          <PaperclipIcon />
        </PressButton>
        {voiceSupported ? (
          <PressButton
            type="button"
            className={`ob-icon${recording ? ' is-live' : ''}`}
            title={recording ? 'Stop recording' : 'Answer with your voice'}
            aria-label="Answer with your voice"
            pressScale={0.92}
            onClick={() => (recording ? stopVoice() : startVoice())}
          >
            <MicIcon />
          </PressButton>
        ) : null}
        <PressButton type="button" className="send" aria-label="Send" pressScale={0.9} onClick={submit}>
          <ArrowIcon />
        </PressButton>
      </div>

      <p className="ob-composer-hint">
        {hint ? (
          hint
        ) : isChoice ? (
          'Pick an option above'
        ) : (
          <>
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
          </>
        )}
      </p>

      <input
        type="file"
        ref={fileRef}
        hidden
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx,.csv,.png,.jpg,.jpeg"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = ''; // so re-picking the same file fires change again
        }}
      />
    </div>
  );
}
