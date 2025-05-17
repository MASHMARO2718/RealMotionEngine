using UnityEngine;
using UnityEngine.Networking;
using System;
using System.Collections;
using System.Collections.Generic;

[Serializable]
public class JointData
{
    public float x;
    public float y;
    public float z;
}

[Serializable]
public class MotionData
{
    public long timestamp;
    public Dictionary<string, JointData> joints;
}

public class MotionDataReceiver : MonoBehaviour
{
    [SerializeField] private string apiUrl = "http://localhost:3000/api/motion";
    [SerializeField] private float pollInterval = 0.033f; // 約30FPS

    private MotionData latestMotionData;
    private bool isPolling = false;

    private void Start()
    {
        StartPolling();
    }

    private void OnDestroy()
    {
        StopPolling();
    }

    public void StartPolling()
    {
        if (!isPolling)
        {
            isPolling = true;
            StartCoroutine(PollMotionData());
        }
    }

    public void StopPolling()
    {
        isPolling = false;
        StopAllCoroutines();
    }

    private IEnumerator PollMotionData()
    {
        while (isPolling)
        {
            yield return StartCoroutine(FetchMotionData());
            yield return new WaitForSeconds(pollInterval);
        }
    }

    private IEnumerator FetchMotionData()
    {
        using (UnityWebRequest request = UnityWebRequest.Get(apiUrl))
        {
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string jsonResponse = request.downloadHandler.text;
                    latestMotionData = JsonUtility.FromJson<MotionData>(jsonResponse);
                    OnMotionDataReceived(latestMotionData);
                }
                catch (Exception e)
                {
                    Debug.LogError($"Error parsing motion data: {e.Message}");
                }
            }
            else
            {
                Debug.LogError($"Error fetching motion data: {request.error}");
            }
        }
    }

    private void OnMotionDataReceived(MotionData data)
    {
        // このメソッドは、モーションデータが更新されたときに呼び出されます
        // アバターの制御スクリプトにデータを渡すために使用します
        if (data != null && data.joints != null)
        {
            // アバターの制御スクリプトにデータを渡す
            var avatarController = GetComponent<AvatarController>();
            if (avatarController != null)
            {
                avatarController.UpdatePose(data);
            }
        }
    }

    public MotionData GetLatestMotionData()
    {
        return latestMotionData;
    }
} 