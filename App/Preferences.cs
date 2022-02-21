using System;
using System.Windows.Forms;

namespace App
{
    /// <summary>
    /// 環境設定ダイアログ
    /// </summary>
    public partial class Preferences : Form
    {
        /// <summary>
        /// 選択中のフックインデックス
        /// </summary>
        private int selectedHookIndex = -1;

        /// <summary>
        /// コントロールの状態に即したフック種別
        /// </summary>
        private HookTypes hookType
        {
            get => this.startingHook.Checked ? HookTypes.Starting : HookTypes.Ending;
        }

        /// <summary>
        /// コンストラクター
        /// </summary>
        public Preferences()
        {
            this.InitializeComponent();
            this.initializeControls();
        }

        /// <summary>
        /// コントロールの状態を初期化します。
        /// </summary>
        private void initializeControls()
        {
            // 監視デバイス
            this.targetAudioDevices.Items.Clear();
            this.targetAudioDevices.Items.Add("");
            AudioStateManager.Devices.ForEach(d => this.targetAudioDevices.Items.Add(d));
            this.targetAudioDevices.SelectedItem = Properties.Settings.Default.TargetAudioDeviceName;

            // フック設定
            this.hooks.BeginUpdate();
            this.hooks.Items.Clear();
            Properties.Settings.Default.Hooks?.ForEach(hook =>
            {
                var item = new ListViewItem
                {
                    Text = Hook.ConvertHookTypeToName(hook.HookType),
                };
                item.SubItems.Add(hook.FileName);
                item.SubItems.Add(hook.Arguments);
                this.hooks.Items.Add(item);
            });
            this.hooks.EndUpdate();

            // 同時多重フック防止
            this.enabledSequential.Checked = Properties.Settings.Default.SequentialMode;
            this.sequentialInterval.Value = Properties.Settings.Default.SequentialInterval;

            this.refreshControls(true);
        }

        /// <summary>
        /// 内部状態に合わせてコントロール上の状態を更新します。
        /// </summary>
        /// <param name="includesHookItemInput">選択中のフック設定項目で編集欄を埋めるかどうか</param>
        private void refreshControls(bool includesHookItemInput = false)
        {
            // フック設定
            if (this.selectedHookIndex == -1)
            {
                this.addOrUpdateButton.Text = "追加(&A)";
            }
            else
            {
                this.addOrUpdateButton.Text = "更新(&U)";

                // 選択中の項目で編集欄を埋める
                if (includesHookItemInput)
                {
                    var hookType = Hook.ConvertHookNameToType(this.hooks.Items[this.selectedHookIndex].Text);
                    this.startingHook.Checked = hookType == HookTypes.Starting;
                    this.endingHook.Checked = hookType == HookTypes.Ending;
                    this.processFileNameText.Text = this.hooks.Items[this.selectedHookIndex].SubItems[1].Text;
                    this.processArgumentsText.Text = this.hooks.Items[this.selectedHookIndex].SubItems[2].Text;
                }
            }
            this.deleteButton.Enabled = this.selectedHookIndex != -1;

            // 同時多重フック防止
            this.sequentialInterval.Enabled = this.enabledSequential.Checked;

            // スタートアップ登録
            this.registerStartupButton.Text = !StartupUtility.IsRegistered ? "スタートアップに登録" : "スタートアップの登録を解除";
        }

        /// <summary>
        /// フックの項目が選択されたらその内容をコントロール上に反映します。
        /// </summary>
        private void hooksSelectedIndexChanged(object sender, EventArgs e)
        {
            this.selectedHookIndex = (this.hooks.SelectedIndices.Count != 0) ? this.hooks.SelectedIndices[0] : -1;

            this.refreshControls(true);
        }

        /// <summary>
        /// フックの項目を削除します。
        /// </summary>
        private void deleteButtonClicked(object sender, EventArgs e)
        {
            if (this.selectedHookIndex != -1)
            {
                this.hooks.Items.RemoveAt(this.selectedHookIndex);
                this.selectedHookIndex = -1;
            }

            this.refreshControls(true);
        }

        /// <summary>
        /// フックの項目を追加または更新します。
        /// </summary>
        private void addOrUpdateButtonClicked(object sender, EventArgs e)
        {
            if (this.selectedHookIndex == -1)
            {
                // 追加
                var item = new ListViewItem
                {
                    Text = Hook.ConvertHookTypeToName(this.hookType),
                };
                item.SubItems.Add(this.processFileNameText.Text);
                item.SubItems.Add(this.processArgumentsText.Text);
                this.hooks.Items.Add(item);
                this.hooks.SelectedIndices.Clear();
                this.hooks.SelectedIndices.Add(this.hooks.Items.Count - 1);
            }
            else
            {
                // 更新
                var item = this.hooks.Items[this.selectedHookIndex];
                item.SubItems[0].Text = Hook.ConvertHookTypeToName(this.hookType);
                item.SubItems[1].Text = this.processFileNameText.Text;
                item.SubItems[2].Text = this.processArgumentsText.Text;
            }
        }

        /// <summary>
        /// スタートアップへの登録・登録解除を行います。
        /// </summary>
        private void registerStartupButtonClicked(object sender, EventArgs e)
        {
            if (!StartupUtility.IsRegistered)
            {
                StartupUtility.Register();
                MessageBox.Show("スタートアップに登録しました。", Program.ProductName, MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                StartupUtility.Unregister();
                MessageBox.Show("スタートアップの登録を解除しました。", Program.ProductName, MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            this.refreshControls();
        }

        /// <summary>
        /// シーケンシャルフックのチェック状態に応じて関連コントロールの状態を変化させます。
        /// </summary>
        private void enabledSequentialCheckedChanged(object sender, EventArgs e)
        {
            this.refreshControls();
        }

        /// <summary>
        /// OKボタンでウィンドウを閉じます。
        /// </summary>
        private void okButtonClicked(object sender, EventArgs e)
        {
            // コントロールの状態を設定値に反映
            var hooks = new Hooks();
            foreach (ListViewItem item in this.hooks.Items)
            {
                hooks.Add(new Hook()
                {
                    HookType = Hook.ConvertHookNameToType(item.SubItems[0].Text),
                    FileName = item.SubItems[1].Text,
                    Arguments = item.SubItems[2].Text,
                });
            }
            Properties.Settings.Default.Hooks = hooks;
            Properties.Settings.Default.TargetAudioDeviceName = (string) this.targetAudioDevices.SelectedItem;
            Properties.Settings.Default.SequentialInterval = (int) this.sequentialInterval.Value;
            Properties.Settings.Default.SequentialMode = this.enabledSequential.Checked;
            Properties.Settings.Default.Save();

            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        /// <summary>
        /// キャンセルボタンでウィンドウを閉じます。
        /// </summary>
        private void cancelButtonClicked(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
    }
}
