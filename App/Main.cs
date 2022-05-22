using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Windows.Forms;

namespace App
{
    /// <summary>
    /// メインフォーム
    /// </summary>
    public partial class Main : Form
    {
        /// <summary>
        /// オーディオ状態管理オブジェクト
        /// </summary>
        private readonly AudioStateManager audioStateManager;

        /// <summary>
        /// シーケンシャルモード用の状態変更イベントキュー
        /// </summary>
        private readonly Queue<HookTypes> audioStateEventQueue = new Queue<HookTypes>();

        /// <summary>
        /// 現在開いている設定フォーム
        /// </summary>
        private Form openingPreferencesForm = null;

        /// <summary>
        /// 現在開いているバージョン情報フォーム
        /// </summary>
        private Form openingAboutForm = null;

        /// <summary>
        /// コンストラクター
        /// </summary>
        public Main()
        {
            this.InitializeComponent();

            var handle = new Action<HookTypes>((type) =>
            {
                if (Properties.Settings.Default.SequentialMode)
                {
                    audioStateEventQueue.Enqueue(type);
                }
                else
                {
                    this.executeHook(type);
                }

                this.refreshControls();
            });
            this.audioStateManager = new AudioStateManager();
            this.audioStateManager.OnUsedStart += (e, sender) => handle(HookTypes.Starting);
            this.audioStateManager.OnUsedEnd += (e, sender) => handle(HookTypes.Ending);

            this.loadSettings();
            this.refreshControls();
        }

        /// <summary>
        /// 設定をロードします。
        /// </summary>
        private void loadSettings()
        {
            this.audioStateManager.ChangeDevice(Properties.Settings.Default.TargetAudioDeviceName);
            this.sequentialTimer.Enabled = Properties.Settings.Default.SequentialMode;
            this.sequentialTimer.Interval = Properties.Settings.Default.SequentialInterval * 1000;
        }

        /// <summary>
        /// 内部状態に合わせてコントロール上の状態を更新します。
        /// </summary>
        private void refreshControls()
        {
            var used = this.audioStateManager.IsUsed;
            this.tasktrayIcon.Icon = used ? Properties.Resources.mic_on : Properties.Resources.mic_off;
            this.tasktrayIcon.Text = $"On-Air Hooks - {(used ? "ON" : "OFF")}";
        }

        /// <summary>
        /// 設定画面を開きます。
        /// </summary>
        private void openPreferencesButtonClicked(object sender, EventArgs e)
        {
            this.openDialog(ref this.openingPreferencesForm, new Preferences(), () =>
            {
                this.loadSettings();
                this.refreshControls();
            });
        }

        /// <summary>
        /// 設定画面を開きます。
        /// </summary>
        private void tasktrayIconDoubleClicked(object sender, EventArgs e)
        {
            this.openPreferencesButtonClicked(sender, e);
        }

        /// <summary>
        /// バージョン情報画面を開きます。
        /// </summary>
        private void openAboutButtonClicked(object sender, EventArgs e)
        {
            this.openDialog(ref this.openingAboutForm, new About(), null);
        }

        /// <summary>
        /// アプリケーションを終了します。
        /// </summary>
        private void exitButtonClicked(object sender, EventArgs e)
        {
            this.tasktrayIcon.Visible = false;
            Application.Exit();
        }

        /// <summary>
        /// 任意のダイアログを開きます。
        /// </summary>
        private void openDialog<T>(ref Form openingForm, T form, Action commitCallback) where T : Form
        {
            if (openingForm != null)
            {
                openingForm.Activate();
                return;
            }

            openingForm = form;
            if (form.ShowDialog() == DialogResult.OK)
            {
                commitCallback?.Invoke();
            }
            openingForm = null;
        }

        /// <summary>
        /// シーケンシャルに状態変更イベントをフックします。
        /// </summary>
        private void sequentialTimerTick(object sender, EventArgs e)
        {
            if (audioStateEventQueue.Count > 0)
            {
                var type = audioStateEventQueue.Dequeue();
                this.executeHook(type);
            }
        }

        /// <summary>
        /// フック処理を実行します。
        /// </summary>
        /// <param name="type">フック種別</param>
        private void executeHook(HookTypes type)
        {
            if (Properties.Settings.Default.Hooks != null)
            {
                switch (type)
                {
                    case HookTypes.Starting:
                        Properties.Settings.Default.Hooks
                            .Where(h => h.HookType == HookTypes.Starting)
                            .ToList()
                            .ForEach(h => this.startProcess(h));
                        return;

                    case HookTypes.Ending:
                        Properties.Settings.Default.Hooks
                            .Where(h => h.HookType == HookTypes.Ending)
                            .ToList()
                            .ForEach(h => this.startProcess(h));
                        break;
                }
            }
        }

        /// <summary>
        /// フック内容に従ってプロセスをバックグラウンド起動します。
        /// </summary>
        /// <param name="hook">フック内容</param>
        private void startProcess(Hook hook)
        {
            var proc = new Process();
            proc.StartInfo.FileName = hook.FileName;
            proc.StartInfo.Arguments = hook.Arguments;

            // GUI or CLI を問わずサイレントかつバックグラウンドで起動する
            proc.StartInfo.CreateNoWindow = true;
            proc.StartInfo.UseShellExecute = false;
            proc.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;

            proc.Start();
        }
    }
}
