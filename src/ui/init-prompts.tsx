import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, render, useInput, useStdout } from "ink";
import readline from "node:readline";
import chalk from "chalk";
import type { ServiceColor } from "../types/index.js";

export interface InkSelectOption<T> {
  label: string;
  value: T;
  color?: ServiceColor;
}

export type InkPromptResult<T> =
  | { type: "submit"; value: T }
  | { type: "back" };

export async function askInkSelectPrompt<T>(
  prompt: string,
  options: InkSelectOption<T>[],
  defaultIndex: number,
  contextLines: string[] = [],
): Promise<InkPromptResult<T>> {
  return await new Promise<InkPromptResult<T>>((resolve) => {
    let done = false;
    let app: ReturnType<typeof render>;

    clearViewport(process.stdout);

    const finish = (result: InkPromptResult<T>): void => {
      if (done) {
        return;
      }

      done = true;
      app.clear();
      app.unmount();
      clearViewport(process.stdout);
      resolve(result);
    };

    const SelectPrompt = (): React.JSX.Element => {
      const { stdout } = useStdout();
      const [selectedIndex, setSelectedIndex] = useState(
        Math.max(0, Math.min(defaultIndex, options.length - 1)),
      );
      const startedAt = useRef(Date.now());

      useInput((input, key) => {
        if (key.ctrl && input === "c") {
          process.exit(130);
          return;
        }

        if (key.upArrow) {
          setSelectedIndex((previous) =>
            previous <= 0 ? options.length - 1 : previous - 1,
          );
          return;
        }

        if (key.downArrow) {
          setSelectedIndex((previous) => (previous + 1) % options.length);
          return;
        }

        if (key.leftArrow || key.escape) {
          finish({ type: "back" });
          return;
        }

        if (key.return) {
          if (Date.now() - startedAt.current < 120) {
            return;
          }

          const selected = options[selectedIndex];
          if (selected) {
            finish({ type: "submit", value: selected.value });
          }
        }
      });

      const width = getWizardContentWidth(stdout);
      const lines = useMemo(() => {
        const hint = "Use ↑/↓ Enter, ←/Esc back";
        const promptText = truncateText(prompt, width);
        const hintText = truncateText(hint, width);

        const nextLines: string[] = [
          panelTop(width),
          formatPanelLine(
            chalk.bold(promptText),
            Math.min(prompt.length, width),
            width,
          ),
          formatPanelLine(
            chalk.gray(hintText),
            Math.min(hint.length, width),
            width,
          ),
          panelDivider(width),
        ];

        for (let index = 0; index < options.length; index += 1) {
          const option = options[index];
          const selected = index === selectedIndex;
          const marker = selected ? chalk.greenBright(">") : " ";
          const optionLabel = truncateText(
            option.label,
            Math.max(1, width - 2),
          );
          const plain = `${selected ? ">" : " "} ${optionLabel}`;

          let content = `${marker} ${colorizeByServiceColor(optionLabel, option.color)}`;
          if (selected) {
            content = chalk.bold(content);
          }

          nextLines.push(formatPanelLine(content, plain.length, width));
        }

        nextLines.push(panelBottom(width));
        return nextLines;
      }, [selectedIndex, width]);

      return (
        <Box flexDirection="column">
          {contextLines.map((line, index) => (
            <Text key={`ctx-${index}`}>{line}</Text>
          ))}
          {lines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>
      );
    };

    app = render(<SelectPrompt />, { exitOnCtrlC: false });
  });
}

export async function askInkInputPrompt(
  prompt: string,
  defaultValue: string,
  contextLines: string[] = [],
): Promise<InkPromptResult<string>> {
  return await new Promise<InkPromptResult<string>>((resolve) => {
    let done = false;
    let app: ReturnType<typeof render>;

    clearViewport(process.stdout);

    const finish = (result: InkPromptResult<string>): void => {
      if (done) {
        return;
      }

      done = true;
      app.clear();
      app.unmount();
      clearViewport(process.stdout);
      resolve(result);
    };

    const InputPrompt = (): React.JSX.Element => {
      const { stdout } = useStdout();
      const [value, setValue] = useState("");
      const [cursorVisible, setCursorVisible] = useState(true);
      const startedAt = useRef(Date.now());
      const hadInput = useRef(false);

      useEffect(() => {
        const intervalId = setInterval(() => {
          setCursorVisible((previous) => !previous);
        }, 530);

        return () => {
          clearInterval(intervalId);
        };
      }, []);

      useInput((input, key) => {
        if (key.ctrl && input === "c") {
          process.exit(130);
          return;
        }

        if (key.leftArrow || key.escape) {
          finish({ type: "back" });
          return;
        }

        if (key.return) {
          if (!hadInput.current && Date.now() - startedAt.current < 120) {
            return;
          }

          const finalValue = value.trim() ? value : defaultValue;
          finish({ type: "submit", value: finalValue });
          return;
        }

        if (key.backspace || key.delete) {
          hadInput.current = true;
          setValue((previous) => previous.slice(0, -1));
          return;
        }

        if (input.length === 1 && !key.tab) {
          hadInput.current = true;
          setValue((previous) => previous + input);
        }
      });

      const width = getWizardContentWidth(stdout);
      const promptText = truncateText(prompt, width);
      const hintText = truncateText(
        "Type value, Enter confirm, ←/Esc back",
        width,
      );
      const lines = useMemo(() => {
        const fieldWidth = Math.max(1, width - 2);
        const valueLabel = `> ${renderInputField(
          value,
          defaultValue,
          fieldWidth,
          cursorVisible,
          supportsReverseCursor(),
        )}`;

        return [
          panelTop(width),
          formatPanelLine(valueLabel, width, width),
          panelBottom(width),
        ];
      }, [value, defaultValue, width, cursorVisible]);

      return (
        <Box flexDirection="column">
          {contextLines.map((line, index) => (
            <Text key={`ctx-${index}`}>{line}</Text>
          ))}
          <Text>{`  ${chalk.bold.green(promptText)}`}</Text>
          <Text>{`  ${chalk.gray(hintText)}`}</Text>
          {lines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>
      );
    };

    app = render(<InputPrompt />, { exitOnCtrlC: false });
  });
}

function renderInputField(
  value: string,
  defaultValue: string,
  fieldWidth: number,
  cursorVisible: boolean,
  supportsReverse: boolean,
): string {
  if (fieldWidth <= 0) {
    return "";
  }

  if (value.length > 0) {
    const visibleTextWidth = Math.max(0, fieldWidth - 1);
    const clippedValue =
      value.length > visibleTextWidth
        ? value.slice(value.length - visibleTextWidth)
        : value;
    const baseField = clippedValue.padEnd(fieldWidth, " ");
    const cursorIndex = Math.min(clippedValue.length, fieldWidth - 1);
    return renderCursorOverlay(
      baseField,
      cursorIndex,
      cursorVisible,
      supportsReverse,
      chalk.green,
    );
  }

  const placeholder = truncateText(defaultValue, fieldWidth);
  const baseField = placeholder.padEnd(fieldWidth, " ");
  return renderCursorOverlay(
    baseField,
    0,
    cursorVisible,
    supportsReverse,
    chalk.gray,
  );
}

function renderCursorOverlay(
  baseField: string,
  cursorIndex: number,
  cursorVisible: boolean,
  supportsReverse: boolean,
  paint: (value: string) => string,
): string {
  const safeIndex = Math.max(0, Math.min(cursorIndex, baseField.length - 1));
  const before = baseField.slice(0, safeIndex);
  const cursorChar = baseField[safeIndex] ?? " ";
  const after = baseField.slice(safeIndex + 1);

  if (!cursorVisible) {
    return `${paint(before)}${paint(cursorChar)}${paint(after)}`;
  }

  if (supportsReverse) {
    return `${paint(before)}${chalk.inverse(cursorChar)}${paint(after)}`;
  }

  const fallbackChar = cursorChar === " " ? "█" : cursorChar;
  return `${paint(before)}${chalk.greenBright(fallbackChar)}${paint(after)}`;
}

function supportsReverseCursor(): boolean {
  return process.stdout.isTTY;
}

function getWizardContentWidth(stdoutStream: NodeJS.WriteStream): number {
  const columns = stdoutStream.columns ?? 100;
  // Panel rendering adds 4 border/padding characters around content.
  return Math.max(1, columns - 4);
}

function clearViewport(output: NodeJS.WriteStream): void {
  if (!output.isTTY) {
    return;
  }

  readline.cursorTo(output, 0, 0);
  readline.clearScreenDown(output);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return "…";
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatPanelLine(
  content: string,
  plainLength: number,
  width: number,
): string {
  const padding = Math.max(0, width - plainLength);
  return `│ ${content}${" ".repeat(padding)} │`;
}

function panelTop(width: number): string {
  return `╭${"─".repeat(width + 2)}╮`;
}

function panelDivider(width: number): string {
  return `├${"─".repeat(width + 2)}┤`;
}

function panelBottom(width: number): string {
  return `╰${"─".repeat(width + 2)}╯`;
}

function colorizeByServiceColor(value: string, color?: ServiceColor): string {
  if (!color) {
    return value;
  }

  switch (color) {
    case "red":
      return chalk.red(value);
    case "green":
      return chalk.green(value);
    case "yellow":
      return chalk.yellow(value);
    case "blue":
      return chalk.blue(value);
    case "magenta":
      return chalk.magenta(value);
    case "cyan":
      return chalk.green(value);
    case "gray":
      return chalk.gray(value);
    case "white":
    default:
      return chalk.white(value);
  }
}
