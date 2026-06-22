# GSLIB Setup CLI

GSLIB Setup CLI は、GSLIB 用に構成された Visual Studio C++ プロジェクトを作成するための、Windows 向けの Node.js コマンドラインツールです。

このツールは、`.sln`、`.vcxproj`、`.vcxproj.filters`、`src/main.cpp`、および `.gitignore` を直接生成します。生成されたプロジェクトは Visual Studio / Win32 をターゲットとし、ローカルの Visual Studio インストールから検出された PlatformToolset を使用します。

## インストール

このリポジトリからインストールしてください：

```powershell
npm install -g @ciellllllllll/setup
```

インストール後、グローバルコマンドは次のようになります：

```powershell
Setup
```

## 主なコマンド

### 検索

GSLIBのパスとVisual Studioのツールセット設定を検索して保存します：

```powershell
Setup --find
Setup --find "C:\Libraries\gslib_2021"
```

特定のツールセットやプロファイルを選択することもできます:

```powershell
Setup --find "C:\Libraries\gslib_2021" --toolset v142
Setup --find "C:\Libraries\gslib_2021" --as gslib2021
```

### セットアップ

現在のディレクトリに GSLIB プロジェクトを作成します:

```powershell
Setup
Setup "MyGame"
Setup --name "MyGame"
```

名前を指定しない場合、ソリューションディレクトリにはデフォルトの日付ベースの名前が使用され、プロジェクト名は `GSLIB_Project` になります。

### アンインストール

CLI をアンインストールし、保存された Setup 設定を削除します:

```powershell
Setup --uninstall
Setup uninstall
Setup --uninstall --force
```

保存された設定を維持したままアンインストールするには：

```powershell
Setup --uninstall
Setup --uninstall --force
```

### ヘルプ

利用可能なすべてのコマンドとオプションを表示します：

```powershell
Setup --help
```

`Setup --help` を使用すると、プロファイル管理、ツールセットの切り替え、設定の表示、バージョンの表示、更新の確認などの追加コマンドを確認できます。

## JSON 設定

Setup は設定を JSON 形式で保存します。SQLite やカスタムサーバーは使用しません。

設定ファイルは次の場所に保存されます:

```txt
%USERPROFILE%\.gslib-setup\config.json
```

更新チェックの状態は、次の場所に別途保存されます:

```txt
%USERPROFILE%\.gslib-setup\update-check.json
```

アクティブなJSON設定を表示するには、次のように実行します：

```powershell
Setup --config
```

設定ファイルのパスのみを表示するには：

```powershell
Setup --config-path
```
