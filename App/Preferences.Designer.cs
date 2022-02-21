
namespace App
{
    partial class Preferences
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Preferences));
            this.label2 = new System.Windows.Forms.Label();
            this.enabledSequential = new System.Windows.Forms.CheckBox();
            this.sequentialInterval = new System.Windows.Forms.NumericUpDown();
            this.hooks = new System.Windows.Forms.ListView();
            this.columnHeader1 = ((System.Windows.Forms.ColumnHeader)(new System.Windows.Forms.ColumnHeader()));
            this.columnHeader2 = ((System.Windows.Forms.ColumnHeader)(new System.Windows.Forms.ColumnHeader()));
            this.columnHeader3 = ((System.Windows.Forms.ColumnHeader)(new System.Windows.Forms.ColumnHeader()));
            this.startingHook = new System.Windows.Forms.RadioButton();
            this.endingHook = new System.Windows.Forms.RadioButton();
            this.label3 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.processFileNameText = new System.Windows.Forms.TextBox();
            this.processArgumentsText = new System.Windows.Forms.TextBox();
            this.addOrUpdateButton = new System.Windows.Forms.Button();
            this.deleteButton = new System.Windows.Forms.Button();
            this.cancelButton = new System.Windows.Forms.Button();
            this.okButton = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.groupBox3 = new System.Windows.Forms.GroupBox();
            this.targetAudioDevices = new System.Windows.Forms.ComboBox();
            this.label1 = new System.Windows.Forms.Label();
            this.groupBox4 = new System.Windows.Forms.GroupBox();
            this.registerStartupButton = new System.Windows.Forms.Button();
            ((System.ComponentModel.ISupportInitialize)(this.sequentialInterval)).BeginInit();
            this.groupBox1.SuspendLayout();
            this.groupBox2.SuspendLayout();
            this.groupBox3.SuspendLayout();
            this.groupBox4.SuspendLayout();
            this.SuspendLayout();
            // 
            // label2
            // 
            this.label2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(239, 28);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(60, 15);
            this.label2.TabIndex = 1;
            this.label2.Text = "間隔秒数:";
            // 
            // enabledSequential
            // 
            this.enabledSequential.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.enabledSequential.AutoSize = true;
            this.enabledSequential.Location = new System.Drawing.Point(13, 27);
            this.enabledSequential.Name = "enabledSequential";
            this.enabledSequential.Size = new System.Drawing.Size(176, 19);
            this.enabledSequential.TabIndex = 0;
            this.enabledSequential.Text = "シーケンシャルフックを有効にする";
            this.enabledSequential.UseVisualStyleBackColor = true;
            this.enabledSequential.CheckedChanged += new System.EventHandler(this.enabledSequentialCheckedChanged);
            // 
            // sequentialInterval
            // 
            this.sequentialInterval.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.sequentialInterval.Enabled = false;
            this.sequentialInterval.Location = new System.Drawing.Point(306, 25);
            this.sequentialInterval.Maximum = new decimal(new int[] {
            10,
            0,
            0,
            0});
            this.sequentialInterval.Minimum = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.sequentialInterval.Name = "sequentialInterval";
            this.sequentialInterval.Size = new System.Drawing.Size(76, 23);
            this.sequentialInterval.TabIndex = 2;
            this.sequentialInterval.Value = new decimal(new int[] {
            1,
            0,
            0,
            0});
            // 
            // hooks
            // 
            this.hooks.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.hooks.Columns.AddRange(new System.Windows.Forms.ColumnHeader[] {
            this.columnHeader1,
            this.columnHeader2,
            this.columnHeader3});
            this.hooks.FullRowSelect = true;
            this.hooks.GridLines = true;
            this.hooks.HeaderStyle = System.Windows.Forms.ColumnHeaderStyle.Nonclickable;
            this.hooks.HideSelection = false;
            this.hooks.Location = new System.Drawing.Point(13, 26);
            this.hooks.MultiSelect = false;
            this.hooks.Name = "hooks";
            this.hooks.Size = new System.Drawing.Size(437, 135);
            this.hooks.TabIndex = 0;
            this.hooks.UseCompatibleStateImageBehavior = false;
            this.hooks.View = System.Windows.Forms.View.Details;
            this.hooks.SelectedIndexChanged += new System.EventHandler(this.hooksSelectedIndexChanged);
            // 
            // columnHeader1
            // 
            this.columnHeader1.Text = "タイプ";
            // 
            // columnHeader2
            // 
            this.columnHeader2.Text = "ファイル名";
            this.columnHeader2.Width = 100;
            // 
            // columnHeader3
            // 
            this.columnHeader3.Text = "コマンドライン引数";
            this.columnHeader3.Width = 200;
            // 
            // startingHook
            // 
            this.startingHook.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.startingHook.AutoSize = true;
            this.startingHook.Checked = true;
            this.startingHook.Location = new System.Drawing.Point(24, 238);
            this.startingHook.Name = "startingHook";
            this.startingHook.Size = new System.Drawing.Size(87, 19);
            this.startingHook.TabIndex = 5;
            this.startingHook.TabStop = true;
            this.startingHook.Text = "マイク開始時";
            this.startingHook.UseVisualStyleBackColor = true;
            // 
            // endingHook
            // 
            this.endingHook.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.endingHook.AutoSize = true;
            this.endingHook.Location = new System.Drawing.Point(117, 238);
            this.endingHook.Name = "endingHook";
            this.endingHook.Size = new System.Drawing.Size(87, 19);
            this.endingHook.TabIndex = 6;
            this.endingHook.Text = "マイク終了時";
            this.endingHook.UseVisualStyleBackColor = true;
            // 
            // label3
            // 
            this.label3.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(21, 178);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(82, 15);
            this.label3.TabIndex = 1;
            this.label3.Text = "実行ファイル名:";
            // 
            // label4
            // 
            this.label4.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(21, 205);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(96, 15);
            this.label4.TabIndex = 3;
            this.label4.Text = "コマンドライン引数:";
            // 
            // processFileNameText
            // 
            this.processFileNameText.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.processFileNameText.Location = new System.Drawing.Point(127, 175);
            this.processFileNameText.Name = "processFileNameText";
            this.processFileNameText.Size = new System.Drawing.Size(323, 23);
            this.processFileNameText.TabIndex = 2;
            // 
            // processArgumentsText
            // 
            this.processArgumentsText.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.processArgumentsText.Location = new System.Drawing.Point(127, 202);
            this.processArgumentsText.Name = "processArgumentsText";
            this.processArgumentsText.Size = new System.Drawing.Size(323, 23);
            this.processArgumentsText.TabIndex = 4;
            // 
            // addOrUpdateButton
            // 
            this.addOrUpdateButton.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.addOrUpdateButton.Location = new System.Drawing.Point(350, 233);
            this.addOrUpdateButton.Name = "addOrUpdateButton";
            this.addOrUpdateButton.Size = new System.Drawing.Size(100, 28);
            this.addOrUpdateButton.TabIndex = 8;
            this.addOrUpdateButton.Text = "追加(&A)";
            this.addOrUpdateButton.UseVisualStyleBackColor = true;
            this.addOrUpdateButton.Click += new System.EventHandler(this.addOrUpdateButtonClicked);
            // 
            // deleteButton
            // 
            this.deleteButton.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.deleteButton.Location = new System.Drawing.Point(244, 233);
            this.deleteButton.Name = "deleteButton";
            this.deleteButton.Size = new System.Drawing.Size(100, 28);
            this.deleteButton.TabIndex = 7;
            this.deleteButton.Text = "削除(&D)";
            this.deleteButton.UseVisualStyleBackColor = true;
            this.deleteButton.Click += new System.EventHandler(this.deleteButtonClicked);
            // 
            // cancelButton
            // 
            this.cancelButton.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.cancelButton.DialogResult = System.Windows.Forms.DialogResult.Cancel;
            this.cancelButton.Location = new System.Drawing.Point(376, 513);
            this.cancelButton.Name = "cancelButton";
            this.cancelButton.Size = new System.Drawing.Size(100, 28);
            this.cancelButton.TabIndex = 5;
            this.cancelButton.Text = "キャンセル";
            this.cancelButton.UseVisualStyleBackColor = true;
            this.cancelButton.Click += new System.EventHandler(this.cancelButtonClicked);
            // 
            // okButton
            // 
            this.okButton.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.okButton.Location = new System.Drawing.Point(270, 513);
            this.okButton.Name = "okButton";
            this.okButton.Size = new System.Drawing.Size(100, 28);
            this.okButton.TabIndex = 4;
            this.okButton.Text = "OK";
            this.okButton.UseVisualStyleBackColor = true;
            this.okButton.Click += new System.EventHandler(this.okButtonClicked);
            // 
            // groupBox1
            // 
            this.groupBox1.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.groupBox1.Controls.Add(this.hooks);
            this.groupBox1.Controls.Add(this.startingHook);
            this.groupBox1.Controls.Add(this.endingHook);
            this.groupBox1.Controls.Add(this.deleteButton);
            this.groupBox1.Controls.Add(this.label3);
            this.groupBox1.Controls.Add(this.addOrUpdateButton);
            this.groupBox1.Controls.Add(this.label4);
            this.groupBox1.Controls.Add(this.processArgumentsText);
            this.groupBox1.Controls.Add(this.processFileNameText);
            this.groupBox1.Location = new System.Drawing.Point(12, 77);
            this.groupBox1.Margin = new System.Windows.Forms.Padding(5);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(464, 275);
            this.groupBox1.TabIndex = 1;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "フック設定";
            // 
            // groupBox2
            // 
            this.groupBox2.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.groupBox2.Controls.Add(this.enabledSequential);
            this.groupBox2.Controls.Add(this.label2);
            this.groupBox2.Controls.Add(this.sequentialInterval);
            this.groupBox2.Location = new System.Drawing.Point(12, 360);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Size = new System.Drawing.Size(464, 60);
            this.groupBox2.TabIndex = 2;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "同時多重フックの抑止";
            // 
            // groupBox3
            // 
            this.groupBox3.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.groupBox3.Controls.Add(this.targetAudioDevices);
            this.groupBox3.Controls.Add(this.label1);
            this.groupBox3.Location = new System.Drawing.Point(12, 12);
            this.groupBox3.Name = "groupBox3";
            this.groupBox3.Size = new System.Drawing.Size(464, 57);
            this.groupBox3.TabIndex = 0;
            this.groupBox3.TabStop = false;
            this.groupBox3.Text = "監視するデバイス";
            // 
            // targetAudioDevices
            // 
            this.targetAudioDevices.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.targetAudioDevices.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.targetAudioDevices.FormattingEnabled = true;
            this.targetAudioDevices.Location = new System.Drawing.Point(117, 22);
            this.targetAudioDevices.Name = "targetAudioDevices";
            this.targetAudioDevices.Size = new System.Drawing.Size(333, 23);
            this.targetAudioDevices.TabIndex = 1;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(10, 25);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(38, 15);
            this.label1.TabIndex = 0;
            this.label1.Text = "マイク:";
            // 
            // groupBox4
            // 
            this.groupBox4.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.groupBox4.Controls.Add(this.registerStartupButton);
            this.groupBox4.Location = new System.Drawing.Point(12, 426);
            this.groupBox4.Name = "groupBox4";
            this.groupBox4.Size = new System.Drawing.Size(464, 65);
            this.groupBox4.TabIndex = 3;
            this.groupBox4.TabStop = false;
            this.groupBox4.Text = "スタートアップへの登録";
            // 
            // registerStartupButton
            // 
            this.registerStartupButton.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.registerStartupButton.Location = new System.Drawing.Point(13, 25);
            this.registerStartupButton.Name = "registerStartupButton";
            this.registerStartupButton.Size = new System.Drawing.Size(241, 28);
            this.registerStartupButton.TabIndex = 0;
            this.registerStartupButton.Text = "スタートアップに登録する";
            this.registerStartupButton.UseVisualStyleBackColor = true;
            this.registerStartupButton.Click += new System.EventHandler(this.registerStartupButtonClicked);
            // 
            // Preferences
            // 
            this.AcceptButton = this.okButton;
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.CancelButton = this.cancelButton;
            this.ClientSize = new System.Drawing.Size(488, 550);
            this.Controls.Add(this.groupBox4);
            this.Controls.Add(this.groupBox3);
            this.Controls.Add(this.groupBox2);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.cancelButton);
            this.Controls.Add(this.okButton);
            this.Font = new System.Drawing.Font("Meiryo UI", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(128)));
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Margin = new System.Windows.Forms.Padding(3, 4, 3, 4);
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "Preferences";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "設定 - OnAir Hooks";
            ((System.ComponentModel.ISupportInitialize)(this.sequentialInterval)).EndInit();
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.groupBox2.ResumeLayout(false);
            this.groupBox2.PerformLayout();
            this.groupBox3.ResumeLayout(false);
            this.groupBox3.PerformLayout();
            this.groupBox4.ResumeLayout(false);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.CheckBox enabledSequential;
        private System.Windows.Forms.NumericUpDown sequentialInterval;
        private System.Windows.Forms.ListView hooks;
        private System.Windows.Forms.ColumnHeader columnHeader1;
        private System.Windows.Forms.ColumnHeader columnHeader2;
        private System.Windows.Forms.ColumnHeader columnHeader3;
        private System.Windows.Forms.RadioButton startingHook;
        private System.Windows.Forms.RadioButton endingHook;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.TextBox processFileNameText;
        private System.Windows.Forms.TextBox processArgumentsText;
        private System.Windows.Forms.Button addOrUpdateButton;
        private System.Windows.Forms.Button deleteButton;
        private System.Windows.Forms.Button cancelButton;
        private System.Windows.Forms.Button okButton;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.GroupBox groupBox3;
        private System.Windows.Forms.ComboBox targetAudioDevices;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.GroupBox groupBox4;
        private System.Windows.Forms.Button registerStartupButton;
    }
}