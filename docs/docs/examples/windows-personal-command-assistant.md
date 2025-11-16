# Windows 11 개인 명령 실행 비서

Windows 11 환경에서 "제어판 열어줘", "크롬 켜줘", "다운로드 폴더 열어줘"처럼 자연어로 입력한 한국어 명령을 실행하는 Tkinter GUI 프로그램 예시입니다. 기본 입력은 텍스트이지만, 명령 해석을 전담하는 `CommandProcessor`가 GUI와 분리되어 있어 나중에 음성 인식 모듈을 붙여도 동일한 프로세서에 문자열만 전달하면 됩니다.

## 필요한 라이브러리
- Python 3.10 이상
- [Tkinter](https://docs.python.org/3/library/tkinter.html) (표준 라이브러리, Windows 11에서 기본 제공)
- `subprocess`, `pathlib`, `webbrowser`, `tkinter` 등 표준 라이브러리 모듈
- (선택) [PyInstaller](https://pyinstaller.org/en/stable/) – EXE 패키징용

## 파일 구조
```text
examples/
└── windows_personal_command_assistant.py  # GUI + 명령 실행 로직
```

## 전체 코드
아래 코드는 그대로 `examples/windows_personal_command_assistant.py`에 포함되어 있습니다.

```python title="examples/windows_personal_command_assistant.py"
# Windows 11 personal command execution assistant with a Tkinter GUI.
#
# The assistant launches programs, folders, settings pages, or websites when it
# receives Korean natural-language commands such as "제어판 열어줘" or "다운로드
# 폴더 열어줘". The registry/processor split keeps the execution logic separate
# from the Tkinter GUI so that a future voice-input module can reuse the same
# processor by simply passing recognized text strings.

from __future__ import annotations

import os
import subprocess
import sys
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Sequence, Tuple

try:
    import tkinter as tk
    from tkinter import ttk
except Exception as exc:  # pragma: no cover - Tkinter import errors are runtime issues.
    raise RuntimeError("Tkinter is required to run the assistant GUI.") from exc


IS_WINDOWS = os.name == "nt"


def _ensure_windows() -> None:
    if not IS_WINDOWS:
        raise EnvironmentError("이 프로그램은 Windows 11 환경에서 실행하도록 설계되었습니다.")


def _launch_process(command: Sequence[str]) -> None:
    _ensure_windows()
    subprocess.Popen(command, shell=False)


def _start_via_cmd(target: str) -> None:
    "Use the Windows `start` command to launch apps, settings, or URLs."
    _ensure_windows()
    subprocess.Popen(["cmd", "/c", "start", "", target], shell=False)


def _open_folder(path: Path) -> None:
    _ensure_windows()
    if not path.exists():
        raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {path}")
    os.startfile(path)  # type: ignore[attr-defined]


@dataclass
class CommandAction:
    name: str
    description: str
    triggers: Tuple[str, ...]
    handler: Callable[[], str]


class CommandRegistry:
    "Stores the built-in commands and resolves user input."

    def __init__(self) -> None:
        self._actions: List[CommandAction] = []
        self._register_defaults()

    def _register_defaults(self) -> None:
        downloads = Path.home() / "Downloads"
        documents = Path.home() / "Documents"
        desktop = Path.home() / "Desktop"

        self.register(
            CommandAction(
                name="open_control_panel",
                description="제어판을 실행합니다.",
                triggers=("제어판 열어줘", "제어판 켜줘", "control panel"),
                handler=lambda: self._wrap_action(_launch_process, ["control"], "제어판을 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_chrome",
                description="Google Chrome 브라우저를 실행합니다.",
                triggers=("크롬 켜줘", "크롬 열어줘", "chrome"),
                handler=lambda: self._wrap_action(_start_via_cmd, "chrome", "크롬을 실행했습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_downloads",
                description="다운로드 폴더를 엽니다.",
                triggers=("다운로드 폴더 열어줘", "다운로드 열어줘"),
                handler=lambda: self._wrap_action(_open_folder, downloads, "다운로드 폴더를 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_documents",
                description="문서 폴더를 엽니다.",
                triggers=("문서 폴더 열어줘", "문서 열어줘"),
                handler=lambda: self._wrap_action(_open_folder, documents, "문서 폴더를 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_desktop",
                description="바탕화면 폴더를 엽니다.",
                triggers=("바탕화면 열어줘", "바탕화면 폴더"),
                handler=lambda: self._wrap_action(_open_folder, desktop, "바탕화면을 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_settings",
                description="Windows 설정 앱을 엽니다.",
                triggers=("설정 열어줘", "설정 켜줘", "settings"),
                handler=lambda: self._wrap_action(_start_via_cmd, "ms-settings:", "Windows 설정을 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_network_settings",
                description="네트워크 설정 화면을 엽니다.",
                triggers=("네트워크 설정", "와이파이 설정"),
                handler=lambda: self._wrap_action(
                    _start_via_cmd, "ms-settings:network-status", "네트워크 설정을 열었습니다."
                ),
            )
        )

        self.register(
            CommandAction(
                name="open_naver",
                description="네이버 홈페이지를 엽니다.",
                triggers=("네이버 열어줘", "네이버 켜줘"),
                handler=lambda: self._wrap_action(webbrowser.open, "https://www.naver.com", "네이버를 열었습니다."),
            )
        )

        self.register(
            CommandAction(
                name="open_youtube",
                description="유튜브를 엽니다.",
                triggers=("유튜브 열어줘", "유튜브 켜줘", "youtube"),
                handler=lambda: self._wrap_action(webbrowser.open, "https://www.youtube.com", "유튜브를 열었습니다."),
            )
        )

    def register(self, action: CommandAction) -> None:
        self._actions.append(action)

    @staticmethod
    def _normalize(text: str) -> str:
        return text.strip().lower()

    def resolve(self, user_input: str) -> Optional[CommandAction]:
        normalized = self._normalize(user_input)
        for action in self._actions:
            for trigger in action.triggers:
                if trigger.lower() in normalized:
                    return action
        return None

    def _wrap_action(self, func: Callable, *args, success_message: str) -> str:
        func(*args)
        return success_message


class CommandProcessor:
    "Executes resolved commands and provides status strings."

    def __init__(self, registry: Optional[CommandRegistry] = None) -> None:
        self.registry = registry or CommandRegistry()

    def process(self, user_input: str) -> str:
        cleaned = user_input.strip()
        if not cleaned:
            return "명령어를 입력해 주세요."

        action = self.registry.resolve(cleaned)
        if action:
            try:
                return action.handler()
            except Exception as exc:  # pragma: no cover - runtime error reporting.
                return f"❌ '{action.description}' 실행 중 오류가 발생했습니다: {exc}"

        website_result = self._maybe_open_website(cleaned)
        if website_result:
            return website_result

        return self._help_message(cleaned)

    def _maybe_open_website(self, text: str) -> Optional[str]:
        lowered = text.lower()
        if lowered.startswith("http://") or lowered.startswith("https://"):
            webbrowser.open(text)
            return f"🌐 웹사이트를 열었습니다: {text}"
        if " 사이트" in text or "웹사이트" in text:
            parts = text.replace("사이트", "").replace("웹", "").split()
            if parts:
                query = parts[0]
                url = f"https://{query}"
                webbrowser.open(url)
                return f"🌐 추정한 주소({url})를 열었습니다."
        if any(domain in lowered for domain in (".com", ".net", ".org", ".co.kr")):
            url = text if text.startswith("http") else f"https://{text}"
            webbrowser.open(url)
            return f"🌐 웹사이트를 열었습니다: {url}"
        return None

    def _help_message(self, user_input: str) -> str:
        commands = "\n".join(
            f"• {' / '.join(action.triggers)} → {action.description}" for action in self.registry._actions
        )
        lines = [
            f"알 수 없는 명령입니다: '{user_input}'.",
            "",
            "예시 명령어:",
            commands,
            "",
            "웹사이트 주소(예: https://example.com)를 직접 입력하면 브라우저로 열 수 있습니다.",
        ]
        return "\n".join(lines)


class CommandAssistantApp:
    "Tkinter GUI that captures user commands and shows results."

    def __init__(self, root: tk.Tk, processor: Optional[CommandProcessor] = None) -> None:
        self.root = root
        self.processor = processor or CommandProcessor()
        self.root.title("개인 명령 실행 비서")
        self.root.geometry("640x420")
        self.root.resizable(False, False)
        self._build_widgets()

    def _build_widgets(self) -> None:
        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main_frame, text="명령을 입력하세요 (예: '크롬 켜줘')").pack(anchor=tk.W)

        self.command_var = tk.StringVar()
        entry = ttk.Entry(main_frame, textvariable=self.command_var, width=70)
        entry.pack(fill=tk.X, pady=8)
        entry.bind("<Return>", lambda event: self.execute_command())

        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        ttk.Button(button_frame, text="실행", command=self.execute_command).pack(side=tk.LEFT)
        ttk.Button(button_frame, text="지우기", command=self.clear_output).pack(side=tk.LEFT, padx=8)

        ttk.Label(main_frame, text="실행 결과").pack(anchor=tk.W, pady=(16, 0))
        self.result_area = tk.Text(main_frame, height=12, state=tk.DISABLED, wrap=tk.WORD)
        self.result_area.pack(fill=tk.BOTH, expand=True)

        # Placeholder for future voice-input integration button.
        ttk.Button(button_frame, text="(미래) 음성 입력", state=tk.DISABLED).pack(side=tk.RIGHT)

    def execute_command(self) -> None:
        user_input = self.command_var.get()
        result = self.processor.process(user_input)
        self._append_result(result)
        self.command_var.set("")

    def clear_output(self) -> None:
        self.result_area.configure(state=tk.NORMAL)
        self.result_area.delete("1.0", tk.END)
        self.result_area.configure(state=tk.DISABLED)

    def _append_result(self, text: str) -> None:
        self.result_area.configure(state=tk.NORMAL)
        self.result_area.insert(tk.END, text + "\n\n")
        self.result_area.configure(state=tk.DISABLED)
        self.result_area.see(tk.END)


def main(argv: Optional[Sequence[str]] = None) -> int:
    "Entry point for launching the GUI."
    if not IS_WINDOWS:
        print("⚠️  이 프로그램은 Windows 11 전용입니다. 일부 명령은 다른 OS에서 동작하지 않습니다.")

    root = tk.Tk()
    app = CommandAssistantApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

## 빠른 실행 요약
아래 순서를 그대로 따라 하면 GUI가 바로 실행됩니다.

1. **Python 3.10+ 설치** – [python.org](https://www.python.org/downloads/windows/)에서 Windows 설치 패키지를 받아 설치합니다. 설치 중 "Add Python to PATH" 옵션을 체크하면 이후 명령 실행이 간편합니다.
2. **저장소 내려받기** – 이 저장소를 ZIP으로 내려받아 압축을 해제하거나 `git clone`으로 복제합니다.
3. **PowerShell 열기** – 프로젝트 루트(예: `C:\Users\me\langgraph`)에서 PowerShell을 실행합니다.
4. **프로그램 실행** – 아래 두 방법 중 편한 명령 하나를 입력합니다.
   ```powershell
   # 방법 1: 모듈 실행(권장)
   py -m examples.windows_personal_command_assistant

   # 방법 2: 스크립트 직접 실행
   py examples\windows_personal_command_assistant.py
   ```
5. **명령 입력** – Tkinter GUI 창이 뜨면 "크롬 켜줘"와 같이 원하는 명령을 입력한 뒤 Enter 또는 **실행** 버튼을 누릅니다.
6. **결과 확인** – 하단 "실행 결과" 영역에 어떤 명령이 수행됐는지 로그가 누적됩니다.

## 실행 방법 (상세)
1. Windows 11에서 Python 3.10+을 설치합니다.
2. 저장소 루트에서 다음 명령으로 프로그램을 실행합니다.
   ```powershell
   py -m examples.windows_personal_command_assistant
   ```
3. GUI 창이 열리면 예시 명령(제어판 열어줘, 크롬 켜줘 등)을 입력하고 **실행** 버튼 또는 Enter 키를 누릅니다.
4. 실행 로그는 하단 "실행 결과" 영역에 누적 표시됩니다.

## 간단한 테스트 시나리오
- `제어판 열어줘` → 제어판 실행 및 "제어판을 열었습니다." 메시지 확인
- `크롬 켜줘` → Chrome 브라우저 열기
- `다운로드 폴더 열어줘` → `C:\Users\<사용자>\Downloads` 탐색기 창 열기
- `https://langchain.com` → 기본 브라우저에서 웹사이트 열기
- 존재하지 않는 명령 입력 → 지원 명령 목록과 안내 메시지 확인

## 구조와 확장 포인트
- `CommandRegistry`: 명령 트리거(한국어 표현)와 핸들러를 매핑합니다. `register` 호출을 추가하면 커스텀 명령을 쉽게 늘릴 수 있습니다.
- `CommandProcessor`: 문자열 입력을 받아 명령을 찾고 실행 결과 메시지를 돌려줍니다. 음성 인식 결과 텍스트를 이 프로세서에 전달하면 GUI를 수정하지 않고도 기능을 재사용할 수 있습니다.
- `CommandAssistantApp`: Tkinter GUI입니다. 버튼, 입력창, 결과창이 분리되어 있으며 음성 입력용 자리 표시 버튼이 포함되어 있습니다.

## PyInstaller로 EXE 만들기
1. PyInstaller 설치
   ```powershell
   py -m pip install --upgrade pyinstaller
   ```
2. EXE 패키징 (콘솔 숨김 + 리소스 정리)
   ```powershell
   py -m PyInstaller --noconfirm --clean --windowed \
       --name PersonalCommandAssistant \
       examples/windows_personal_command_assistant.py
   ```
3. 생성된 `dist/PersonalCommandAssistant/PersonalCommandAssistant.exe` 파일을 실행하면 GUI가 바로 뜹니다.
4. 추가 데이터(아이콘, 명령 프리셋 등)를 포함하려면 `--icon` 또는 `--add-data` 옵션을 함께 지정합니다.

## 참고 사항
- Windows 전용 기능(`os.startfile`, `ms-settings:` URI 등)을 사용하므로 다른 운영체제에서는 제한됩니다.
- 명령어는 한국어 자연어를 기준으로 작성되었으며, `CommandRegistry`에 트리거를 추가하면 원하는 문장을 자유롭게 확장할 수 있습니다.
- 음성 입력을 붙일 경우 `speech_recognition` 또는 Azure STT 등에서 받아온 텍스트를 `CommandProcessor.process()`에 전달하면 됩니다.
