using System;

namespace App
{
    /// <summary>
    /// フック種別
    /// </summary>
    public enum HookTypes
    {
        /// <summary>
        /// 開始時
        /// </summary>
        Starting,

        /// <summary>
        /// 終了時
        /// </summary>
        Ending,
    }

    /// <summary>
    /// フック内容
    /// </summary>
    public class Hook
    {
        /// <summary>
        /// フック種別
        /// </summary>
        public HookTypes HookType
        {
            get; set;
        }

        /// <summary>
        /// 起動する実行ファイル名
        /// </summary>
        public string FileName
        {
            get; set;
        }

        /// <summary>
        /// 起動時のコマンドライン引数
        /// </summary>
        public string Arguments
        {
            get; set;
        }

        /// <summary>
        /// フック種別から名称を返します。
        /// </summary>
        /// <param name="type">フック種別</param>
        /// <returns>フック名称</returns>
        public static string ConvertHookTypeToName(HookTypes type)
        {
            switch (type)
            {
                case HookTypes.Starting:
                    return "開始時";
                case HookTypes.Ending:
                    return "終了時";
                default:
                    throw new ArgumentException();
            }
        }

        /// <summary>
        /// フック名称から種別を返します。
        /// </summary>
        /// <param name="name">フック名称</param>
        /// <returns>フック種別</returns>
        public static HookTypes ConvertHookNameToType(string name)
        {
            switch (name)
            {
                case "開始時":
                    return HookTypes.Starting;
                case "終了時":
                    return HookTypes.Ending;
                default:
                    throw new ArgumentException();
            }
        }
    }
}
