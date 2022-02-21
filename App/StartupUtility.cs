using System.Windows.Forms;
using Microsoft.Win32;

namespace App
{
    /// <summary>
    /// スタートアップ登録ユーティリティ
    /// </summary>
    public static class StartupUtility
    {
        private const string registryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";

        /// <summary>
        /// スタートアップに登録します。
        /// </summary>
        public static void Register()
        {
            using (var key = Registry.CurrentUser.OpenSubKey(registryKeyPath, true))
            {
                key.SetValue(valueName, $"\"{Application.ExecutablePath}\"");
            }
        }

        /// <summary>
        /// スタートアップの登録を解除します。
        /// </summary>
        public static void Unregister()
        {
            using (var key = Registry.CurrentUser.OpenSubKey(registryKeyPath, true))
            {
                key.DeleteValue(valueName);
            }
        }

        /// <summary>
        /// スタートアップに登録されているかどうか
        /// </summary>
        public static bool IsRegistered
        {
            get {
                using (var key = Registry.CurrentUser.OpenSubKey(registryKeyPath, false))
                {
                    return key.GetValue(valueName) != null;
                }
            }
        }

        /// <summary>
        /// レジストリに書き込む値の名前
        /// </summary>
        private static string valueName
        {
            get => Program.ProductName;
        }
    }
}
