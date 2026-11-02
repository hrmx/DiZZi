# DiZZi 0.2 [![blog](https://raw.githubusercontent.com/syxanash/awesome-web-desktops/refs/heads/main/assets/notebook.png)](https://blog.simone.computer/reverse-beyblade-launch-tracker)

[DiZZi](https://beyblade.fandom.com/wiki/Dizzi) is Kenny's AI companion from the 2001 Beyblade anime, brought back as a web app.
It connects to a [Beybattle Pass BX-09](https://beyblade.fandom.com/wiki/Beybattle_Pass), shows your Shoot Power data, and roasts your launches.

## 日本語版の使い方（`ja` ブランチ）

このブランチは、DiZZi のコメント生成と読み上げを日本語化した改造版です。
AI キャラクターが子どもの名前を呼びながら、「励まし 7：茶化し 3」くらいの口調でシュートにコメントします。
読み上げには Ollama の phonon ではなく **macOS 標準の `say` コマンド** を使うため、AI モード（`AI_ENABLED=true`）は macOS 専用です。

### 起動手順

1. Node 24 と [Ollama](https://ollama.com/download) を用意する（`nvm use` / `brew install ollama` など）
2. 依存パッケージを入れる: `npm i`
3. 日本語用の LLM を取得し、Ollama を起動しておく: `ollama pull gemma3:4b` → `ollama serve`（Ollama アプリを起動している場合は不要）
4. `.env` の内容を確認する（下表を参照。既定値のままで動きます）
5. プロジェクト直下に `.env.local` を作り、子どもの名前を書く（このファイルは `.gitignore` 済みで push されません）:
   ```
   PLAYER_NAME=たろう
   ```
6. 起動して http://localhost:4173 を開く:
   ```sh
   npm run prod-start
   ```

### 設定項目

`.env`（git 管理）と `.env.local`（git 管理外・上書き用）の両方が読み込まれます。名前など公開したくない値は `.env.local` に書いてください。

| 変数 | 既定値 | 説明 |
|---|---|---|
| `AI_ENABLED` | `false` | `true`: Gemma 3 がコメントを生成し `say` が読み上げる（macOS 専用）。`false`: 日本語の録音済みクリップを再生（Ollama 不要） |
| `BACKEND_PORT` | `4567` | バックエンドのポート |
| `PLAYER_NAME` | （空） | 子どもの名前。読み上げ精度のため **ひらがな／カタカナ推奨**。`.env.local` に書く。空なら名前を呼ばない |
| `LLM_MODEL` | `gemma3:4b` | Ollama のモデル名。`gemma3:1b` は日本語が不安定なので 4b 推奨 |
| `TTS_VOICE` | `Kyoko` | macOS の日本語音声名（下記「日本語音声の確認」参照） |
| `DEBUG` | （空） | `true` にすると実機なしでシュートを擬似発生させる `POST /api/debug/launch` が有効になる |

### 子どもの名前の変え方

1. `.env.local` の `PLAYER_NAME=` を書き換える
2. サーバーを再起動する（`npm run prod-start` をやり直す）。AI モードの呼びかけはこれだけで変わります
3. AI 無効モード（`AI_ENABLED=false`）でも名前を呼ばせたい場合は、名前入りクリップを生成し直す:
   ```sh
   npm run gen-ja-clips
   ```
   `PLAYER_NAME` が設定されていると `backend/public/audio-local/`（git 管理外）に出力され、存在すればそちらが優先して使われます。`PLAYER_NAME` が空のときは名前なしの汎用クリップを `backend/public/audio/` に出力します（リポジトリに入っているのはこちら）。

### 日本語音声の確認・追加

利用できる日本語音声は次のコマンドで確認できます:

```sh
say -v '?' | grep ja_JP
```

`Kyoko` が無い場合は、**システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声 → 「声を管理…」→ 日本語** から追加してください。追加した音声名を `.env` の `TTS_VOICE` に書けば切り替わります。

### 口調の調整方法

AI モードの口調は `backend/llm.js` の `SYSTEM_PROMPT` で決まります。主に直す場所:

- 「7割は励まし、3割はちょっとだけ茶化す」の行 … 励ましと茶化しの比率
- 「1文だけ、30文字以内」の行 … 長さ
- 「RPMの目安: …」の行 … 弱い／まずまず／すごいの境目（数値はコード側で計算して渡しているので、モデルに計算させる必要はありません）
- 末尾の「例: …」 … 口調の見本。ここを変えると出力の雰囲気が一番変わります

モデルが英語を返してしまったときは一度だけ再試行し、それでもダメなら `backend/llm.js` の `fallbackComment()` にある日本語の定型文を使います。定型文もここで編集できます。

AI 無効モードのセリフは `scripts/gen-ja-clips.mjs` のフレーズ表（`praise_*` が褒め、`roast_*` が茶化し）を編集して `npm run gen-ja-clips` で作り直してください。装着時・落下時などの固定セリフは `src/App.jsx` の `say(...)` 呼び出しにあります。

### 実機（ベイバトルパス）なしで動作確認する

```sh
DEBUG=true npm run prod-start
```

別のターミナルで、RPM を指定して擬似シュートを送ります:

```sh
npm run fake-launch -- 4200
```

ブラウザを開いた状態で実行すると、「日本語コメントが生成される → `say` で音声が作られる → ブラウザで再生される」までを実機なしで確認できます。何度か送ると「前より上がった／下がった」という文脈もコメントに反映されます。

### トラブルシューティング（日本語版）

- **コメントが出ない**: Ollama が起動しているか、`ollama list` に `gemma3:4b` があるかを確認
- **音声が出ない（AI モード）**: `say -v Kyoko "テスト"` がターミナルで鳴るか確認。鳴らなければ上記の手順で日本語音声を追加
- **音声が英語のまま／古いクリップが鳴る（AI 無効モード）**: `backend/public/audio` または `audio-local` の中身を確認し、`npm run gen-ja-clips` で作り直す
- **`fake-launch` が 404**: サーバーを `DEBUG=true` 付きで起動しているか確認
- **`npm i` が `@abandonware/noble` のビルドで失敗する（`fatal error: 'functional' file not found`）**: Command Line Tools の C++ ヘッダが欠けている状態です。根本対策は CLT の再インストール（`sudo rm -rf /Library/Developer/CommandLineTools && xcode-select --install`）ですが、次のように SDK 内のヘッダを指定すればそのままビルドできます:
  ```sh
  CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1 npm i
  ```

## Screenshot

![screenshot](external-assets/dizzi.png)

## Download the desktop app

The easiest way to use DiZZi is to grab the desktop app for macOS (Apple Silicon) or Windows from the [Releases page](https://github.com/syxanash/DiZZi/releases):

- **macOS:** download the `.dmg`, open it and drag Dizzi into Applications
- **Windows:** download the `.exe` and run the installer

The desktop app always uses the prerecorded voice clips, so Ollama isn't needed.

The app isn't code-signed, so your OS will warn you the first time you open it:

- **macOS:** right-click Dizzi in Applications and choose **Open**, then confirm. If macOS says the app is damaged, run `xattr -cr /Applications/Dizzi.app` in the Terminal and try again. Allow Bluetooth access when asked.
- **Windows:** when SmartScreen shows "Windows protected your PC", click **More info**, then **Run anyway**.

To run DiZZi from source instead (needed for the AI features), follow the steps below.

## Requirements

- Node 24 (version pinned in `.nvmrc`) and [nvm](https://github.com/nvm-sh/nvm)
- A Beybattle Pass BX-09
- A computer with Bluetooth (uses [`@abandonware/noble`](https://github.com/abandonware/noble) to talk to the Pass)
- [Ollama](https://ollama.com/download), only needed if you enable the AI features

## Setup and Installation

### 1. Clone the repository

```sh
git clone https://github.com/syxanash/dizzi.git
cd dizzi
```

### 2. Install Node dependencies

```sh
nvm use && npm i
```

### 3. Set up Ollama (optional)

Skip this step if you leave `AI_ENABLED=false`: DiZZi will use the prerecorded voice clips instead.

After [installing Ollama](https://ollama.com/download), pull the language and speech models:

```sh
ollama pull gemma3:4b
```

Speech is generated with the macOS `say` command (Japanese voice), so the AI mode runs on macOS only.

## Configure

Create a `.env` file in the project root (`.env.local` is also loaded, for local overrides):

```
AI_ENABLED=true
BACKEND_PORT=4567
```

| Variable       | Default | Description                                                                 |
|----------------|---------|-----------------------------------------------------------------------------|
| `AI_ENABLED`   | `false` | `true`: Gemma 3 launch comments (Japanese) read by macOS `say`. `false`: prerecorded Japanese clips, no Ollama needed |
| `BACKEND_PORT` | `4567`  | Port of the backend server; the frontend proxies `/api` and `/ws` to it    |
| `PLAYER_NAME`  | (empty) | Child's name used in the comments; put it in `.env.local` (gitignored)     |
| `LLM_MODEL`    | `gemma3:4b` | Ollama model used for the comments                                      |
| `TTS_VOICE`    | `Kyoko` | macOS `say` voice used for speech                                           |
| `DEBUG`        | (empty) | `true` enables `POST /api/debug/launch` to simulate launches without the Pass |

## Usage

To start DiZZi, run this from the root of the project:

```sh
npm run prod-start
```

Then open [http://localhost:4173](http://localhost:4173).

For development, with hot reload, run:

```sh
npm run dev-start
```

Then open [http://localhost:5173](http://localhost:5173).

To run the desktop app from source (AI is always disabled there), run:

```sh
npm run electron
```

## Resetting Scores

If you click the tiny square button with the cross in it (beside the logo) you will wipe the entire Beybattle Pass internal database and start counting all scores from scratch.

![reset](external-assets/reset.png)

## Architecture

![architecture](external-assets/beyblade-arch.png)

The Node backend reads launch data from the Beybattle Pass over Bluetooth LE and streams it to the React frontend over a WebSocket. When AI is enabled, the backend asks Gemma 3 (via Ollama) to comment on each launch, and Phonon (also via Ollama) reads the comment out loud. When AI is disabled, Ollama is never queried: the backend picks a prerecorded praise clip for strong launches or a roast clip for weak ones (from `backend/public/audio`), and the frontend plays it.

## Troubleshooting

- **The Battlepass isn't found:** make sure Bluetooth is on, the Battlepass is awake and nearby, and (on macOS) your terminal, or the Dizzi app, has Bluetooth permission in System Settings → Privacy & Security → Bluetooth.
- **No AI comments:** check that `AI_ENABLED=true` is set, that Ollama is running, and that the `LLM_MODEL` (default `gemma3:4b`) has been pulled.
- **Comments show up but there's no voice:** check that `say -v Kyoko "テスト"` works in a terminal (see the Japanese section above for adding voices).
- **No voice with AI disabled:** check that the `.wav` clips are in `backend/public/audio`.
- **Frontend can't reach the backend:** make sure `BACKEND_PORT` is the same for both, and that nothing else is using that port.

## External resources

* Text-to-speech: macOS `say` command (Japanese voices)
* LLM: [Gemma 3:4b](https://ollama.com/library/gemma3), pulled from Ollama
* Prerecorded Japanese voice clips generated with `say` via `scripts/gen-ja-clips.mjs`
