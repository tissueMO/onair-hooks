using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;

namespace App
{
    /// <summary>
    /// オーディオ状態管理
    /// </summary>
    public class AudioStateManager
    {
        /// <summary>
        /// 対象オーディオデバイスが使用された時に呼び出されます。
        /// </summary>
        public event EventHandler OnUsedStart;

        /// <summary>
        /// 対象オーディオデバイスの使用を終えた時に呼び出されます。
        /// </summary>
        public event EventHandler OnUsedEnd;

        /// <summary>
        /// 監視対象にできるオーディオデバイスの一覧
        /// </summary>
        public static List<string> Devices
        {
            get => new MMDeviceEnumerator().EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.All)
                .ToList()
                .Select(d => d.DeviceFriendlyName)
                .ToList();
        }

        /// <summary>
        /// 対象オーディオデバイスが使用中かどうか
        /// </summary>
        public bool IsUsed
        {
            get
            {
                var device = this.createDevice();
                var state = Enumerable.Range(0, device.AudioSessionManager.Sessions.Count)
                    .ToList()
                    .Any(i => device.AudioSessionManager.Sessions[i].State == AudioSessionState.AudioSessionStateActive);
                this.lastState = state;
                return state;
            }
        }

        /// <summary>
        /// 前回の対象オーディオデバイス使用状態
        /// </summary>
        private bool? lastState = null;

        /// <summary>
        /// 対象オーディオデバイス名
        /// </summary>
        private string targetDeviceName;

        /// <summary>
        /// 対象オーディオデバイス (イベント捕捉用)
        /// </summary>
        private MMDevice device;

        /// <summary>
        /// 監視対象のオーディオデバイスを変更します。
        /// </summary>
        public void ChangeDevice(string targetDeviceName)
        {
            this.stopMonitoring();

            this.targetDeviceName = targetDeviceName;
            this.device = this.createDevice();

            this.startMonitoring();
        }

        /// <summary>
        /// 対象オーディオデバイスを生成します。
        /// </summary>
        private MMDevice createDevice()
        {
            var enumerator = new MMDeviceEnumerator();
            return enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.All)
                .ToList()
                .Find(d => d.DeviceFriendlyName == this.targetDeviceName)
                ?? enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Multimedia);
        }

        /// <summary>
        /// 対象オーディオデバイスの状態監視を開始します。
        /// </summary>
        private void startMonitoring()
        {
            if (this.device == null)
            {
                throw new InvalidOperationException();
            }

            var handler = new CustomAudioSessionEventsHandler(() =>
            {
                var lastState = this.lastState;
                var used = this.IsUsed;
                var hookType = used ? HookTypes.Starting : HookTypes.Ending;

                if (!lastState.HasValue || lastState.Value != used)
                {
                    Debug.WriteLine(
                        $"オーディオデバイス [{this.device.DeviceFriendlyName}] の使用状態が変更されました: " +
                        $"{(lastState.HasValue ? (lastState.Value ? "使用中" : "未使用") : "---")} -> " +
                        $"{(used ? "使用中" : "未使用")}"
                    );
                    if (used)
                    {
                        this.OnUsedStart?.Invoke(this, null);
                    }
                    else
                    {
                        this.OnUsedEnd?.Invoke(this, null);
                    }
                }
            });
            Enumerable.Range(0, this.device.AudioSessionManager.Sessions.Count)
                .ToList()
                .ForEach(i => this.device.AudioSessionManager.Sessions[i].RegisterEventClient(handler));
            this.device.AudioSessionManager.OnSessionCreated += (sender, e)
                => e.RegisterAudioSessionNotification(new AudioSessionEventsCallback(handler));

            Debug.WriteLine($"オーディオデバイス [{this.device.DeviceFriendlyName}] の使用状態を監視します...");
        }

        /// <summary>
        /// 対象オーディオデバイスの状態監視を停止します。
        /// </summary>
        private void stopMonitoring()
        {
            if (this.device != null)
            {
                Debug.WriteLine($"オーディオデバイス [{this.device.DeviceFriendlyName}] の使用状態の監視を停止します");
                this.device.Dispose();
                this.device = null;
                GC.Collect();
            }
        }
    }
}
