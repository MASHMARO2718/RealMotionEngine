using UnityEngine;
using System.Collections.Generic;

public class AvatarController : MonoBehaviour
{
    [SerializeField] private Transform[] jointTransforms;
    [SerializeField] private float smoothingFactor = 0.3f;
    [SerializeField] private Vector3 positionOffset = Vector3.zero;
    [SerializeField] private Vector3 rotationOffset = Vector3.zero;
    [SerializeField] private float scaleFactor = 1.0f;

    private Dictionary<string, Transform> jointMap;
    private Dictionary<string, Quaternion> targetRotations;
    private Dictionary<string, Quaternion> currentRotations;

    private void Awake()
    {
        InitializeJointMap();
        InitializeRotations();
    }

    private void InitializeJointMap()
    {
        jointMap = new Dictionary<string, Transform>();
        foreach (Transform joint in jointTransforms)
        {
            jointMap[joint.name] = joint;
        }
    }

    private void InitializeRotations()
    {
        targetRotations = new Dictionary<string, Quaternion>();
        currentRotations = new Dictionary<string, Quaternion>();

        foreach (var joint in jointMap)
        {
            targetRotations[joint.Key] = joint.Value.localRotation;
            currentRotations[joint.Key] = joint.Value.localRotation;
        }
    }

    public void UpdatePose(MotionData motionData)
    {
        if (motionData == null || motionData.joints == null) return;

        foreach (var jointData in motionData.joints)
        {
            string jointName = jointData.Key;
            if (jointMap.TryGetValue(jointName, out Transform jointTransform))
            {
                // 座標を回転に変換
                Vector3 position = new Vector3(
                    jointData.Value.x * scaleFactor,
                    jointData.Value.y * scaleFactor,
                    jointData.Value.z * scaleFactor
                ) + positionOffset;

                // 位置の更新
                jointTransform.localPosition = position;

                // 回転の更新（必要に応じて）
                if (jointData.Value.x != 0 || jointData.Value.y != 0 || jointData.Value.z != 0)
                {
                    Quaternion targetRotation = Quaternion.Euler(
                        position.x + rotationOffset.x,
                        position.y + rotationOffset.y,
                        position.z + rotationOffset.z
                    );

                    targetRotations[jointName] = targetRotation;
                }
            }
        }

        // スムージングを適用
        SmoothRotations();
    }

    private void SmoothRotations()
    {
        foreach (var joint in jointMap)
        {
            if (targetRotations.ContainsKey(joint.Key) && currentRotations.ContainsKey(joint.Key))
            {
                currentRotations[joint.Key] = Quaternion.Slerp(
                    currentRotations[joint.Key],
                    targetRotations[joint.Key],
                    smoothingFactor
                );

                joint.Value.localRotation = currentRotations[joint.Key];
            }
        }
    }

    private void LateUpdate()
    {
        // 必要に応じて追加の更新処理をここに記述
    }
} 