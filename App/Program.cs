using System;
using System.Reflection;
using System.Windows.Forms;

namespace App
{
    static class Program
    {
        /// <summary>
        /// アプリケーションのメイン エントリ ポイントです。
        /// </summary>
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            _ = new Main();
            Application.Run();
        }

        /// <summary>
        /// 製品名
        /// </summary>
        public static string ProductName
        {
            get => (Assembly.GetExecutingAssembly().GetCustomAttributes(typeof(AssemblyProductAttribute), false)[0] as AssemblyProductAttribute)?.Product ?? "";
        }
    }
}
