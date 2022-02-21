ON-AIR Hooks
===

## Summary

マイク利用時に任意の処理をフックできるユーティリティアプリです。


## Usage

![ScreenShot](https://user-images.githubusercontent.com/20965271/154978789-051cb926-08a9-44a5-a988-bf1ed358c231.png)

1. 起動後、タスクトレイにアイコンが表示されます。
1. タスクトレイアイコンを右クリック→設定もしくはダブルクリックで設定画面を開きます。
1. 監視するオーディオデバイス、フック設定等を行います。
    - フック設定のコマンドライン引数はスペースで区切られて渡され、ダブルクォートで括った文字列は1つの引数として扱われます。
    - フック設定のコマンドライン引数内でダブルクォートで括った文字列の中でダブルクォートを含めるにはトリプルエスケープする必要があります。
    - シーケンシャルフックを有効にすると、マイクミュートを高速で有効化-解除を繰り返した場合等でインターネットを経由するような処理を含むフックイベントの遅延や前後を防ぐことができます。
1. スタートアップに登録した場合、設定値がレジストリに書き込まれるためアンインストール時は手動で解除しておく必要があります。


## For Example...

![architecture](https://user-images.githubusercontent.com/20965271/154978423-0cd422d8-eeef-4cf9-9fc3-a7d1dbca70c4.png)


## References

- [ICOOON MONO](https://icooon-mono.com/)
    - このリポジトリーで使用しているアイコンの著作権は上記サイトの TopeconHeroes 様に帰属します。


## License

[MIT](LICENSE.md)


## Author

[tissueMO](https://github.com/tissueMO)
