
namespace App
{
    partial class Main
    {
        /// <summary>
        /// 必要なデザイナー変数です。
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// 使用中のリソースをすべてクリーンアップします。
        /// </summary>
        /// <param name="disposing">マネージド リソースを破棄する場合は true を指定し、その他の場合は false を指定します。</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows フォーム デザイナーで生成されたコード

        /// <summary>
        /// デザイナー サポートに必要なメソッドです。このメソッドの内容を
        /// コード エディターで変更しないでください。
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Main));
            this.sequentialTimer = new System.Windows.Forms.Timer(this.components);
            this.tasktrayIcon = new System.Windows.Forms.NotifyIcon(this.components);
            this.contextMenuStrip = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.openPreferencesButton = new System.Windows.Forms.ToolStripMenuItem();
            this.toolStripSeparator1 = new System.Windows.Forms.ToolStripSeparator();
            this.exitButton = new System.Windows.Forms.ToolStripMenuItem();
            this.openAboutButton = new System.Windows.Forms.ToolStripMenuItem();
            this.contextMenuStrip.SuspendLayout();
            this.SuspendLayout();
            // 
            // sequentialTimer
            // 
            this.sequentialTimer.Interval = 1000;
            this.sequentialTimer.Tick += new System.EventHandler(this.sequentialTimerTick);
            // 
            // tasktrayIcon
            // 
            this.tasktrayIcon.ContextMenuStrip = this.contextMenuStrip;
            this.tasktrayIcon.Icon = ((System.Drawing.Icon)(resources.GetObject("tasktrayIcon.Icon")));
            this.tasktrayIcon.Text = "On-Air Hooks";
            this.tasktrayIcon.Visible = true;
            this.tasktrayIcon.DoubleClick += new System.EventHandler(this.tasktrayIconDoubleClicked);
            // 
            // contextMenuStrip
            // 
            this.contextMenuStrip.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.openPreferencesButton,
            this.openAboutButton,
            this.toolStripSeparator1,
            this.exitButton});
            this.contextMenuStrip.Name = "contextMenuStrip";
            this.contextMenuStrip.Size = new System.Drawing.Size(181, 98);
            // 
            // openPreferencesButton
            // 
            this.openPreferencesButton.Name = "openPreferencesButton";
            this.openPreferencesButton.Size = new System.Drawing.Size(180, 22);
            this.openPreferencesButton.Text = "設定(&P)...";
            this.openPreferencesButton.Click += new System.EventHandler(this.openPreferencesButtonClicked);
            // 
            // toolStripSeparator1
            // 
            this.toolStripSeparator1.Name = "toolStripSeparator1";
            this.toolStripSeparator1.Size = new System.Drawing.Size(177, 6);
            // 
            // exitButton
            // 
            this.exitButton.Name = "exitButton";
            this.exitButton.Size = new System.Drawing.Size(180, 22);
            this.exitButton.Text = "終了(&E)";
            this.exitButton.Click += new System.EventHandler(this.exitButtonClicked);
            // 
            // openAboutButton
            // 
            this.openAboutButton.Name = "openAboutButton";
            this.openAboutButton.Size = new System.Drawing.Size(180, 22);
            this.openAboutButton.Text = "バージョン情報(&V)...";
            this.openAboutButton.Click += new System.EventHandler(this.openAboutButtonClicked);
            // 
            // Main
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(233, 145);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "Main";
            this.ShowIcon = false;
            this.ShowInTaskbar = false;
            this.contextMenuStrip.ResumeLayout(false);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Timer sequentialTimer;
        private System.Windows.Forms.NotifyIcon tasktrayIcon;
        private System.Windows.Forms.ContextMenuStrip contextMenuStrip;
        private System.Windows.Forms.ToolStripMenuItem openPreferencesButton;
        private System.Windows.Forms.ToolStripSeparator toolStripSeparator1;
        private System.Windows.Forms.ToolStripMenuItem exitButton;
        private System.Windows.Forms.ToolStripMenuItem openAboutButton;
    }
}

