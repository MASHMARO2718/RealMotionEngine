# 1. Paper Information
**Title**: *Human Pose Estimation Using MediaPipe Pose and Optimization Method Based on a Humanoid Model*  
**Citation**: Kim _et al._, *Applied Sciences* **13** (2023) 2700

---

# 2. Goals & Motivation
1. **Deployable elderly‑care monitoring** – recognise dangerous poses (e.g. falls) on a low-cost mobile robot without GPUs.  
2. **Bypass 3‑D data scarcity** – use lightweight 2‑D landmark detection (MediaPipe Pose) and lift it to 3‑D with a physics‑aware optimisation.

---

# 3. Method Overview
## 3.1 Processing Pipeline
1. **2‑D landmark extraction** with MediaPipe Pose (33 landmarks, 12 key points used).  
2. **Humanoid model fitting** – 23‑DOF full‑body model with added 3‑DOF lumbar joint.  
3. **Camera & scale parameters** – body angles $(\theta_{bd},\phi_{bd},\psi_{bd})$ plus global scale $\gamma$ model viewpoint & distance.  
4. **uDEAS optimisation** – hybrid global‑local search minimises a multi‑term loss.

## 3.2 Optimisation Vector
$$
\mathbf V=
[\gamma,\theta_{bd},\phi_{bd},\psi_{bd},
 \theta_{tr},\phi_{tr},\psi_{tr},
 \theta_{hp}^l,\theta_{kn}^l,\theta_{hp}^r,\theta_{kn}^r,
 \theta_{sh}^l,\theta_{el}^l,\theta_{sh}^r,\theta_{el}^r,
 \phi_{hp}^l,\phi_{hp}^r,\phi_{sh}^l,\phi_{sh}^r]^{\top}
\tag{1}
$$
(total 19 variables after fixing wrists/ankles).

---

# 4. Loss Function
### 4.1 Pose‑Match Term (MPJPE)
$$
\text{MPJPE}(\mathbf V)=\frac1{12}\sum_{i,j}
\left\|
\bigl(x_{p}^{i,j},y_{p}^{i,j}\bigr)-
\bigl(y_{c}^{i,j},z_{c}^{i,j}\bigr)
\right\|_2
\tag{2}
$$

### 4.2 Stability Term
Center‑of‑mass deviation on the floor:  
$$
\text{CoMD}(\mathbf V)=
\frac{\displaystyle\left\|
(\,x_{CoM},y_{CoM})-
\frac{(x_{ft}^l,y_{ft}^l)+(x_{ft}^r,y_{ft}^r)}{2}\right\|_2}
{l_{\text{leg}}}
\tag{3}
$$

### 4.3 Penalty & Symmetry
Single-/double‑sided penalties  
$$
P_{sn}(\theta,\sigma)=\begin{cases}
|\theta-\sigma|,&\theta<\sigma\\ 0,&\theta\ge\sigma
\end{cases},\quad
P_{sp},\,P_d\;\text{analogous}
\tag{4}
$$

### 4.4 Total Loss
$$
\begin{aligned}
L(\mathbf V)=&\;
\text{MPJPE}+
\gamma_{CoM}\,\text{CoMD}+
\gamma_{sym}\sum\bigl|\theta_{hp}^l-\theta_{hp}^r\bigr|+\dots\\
&\;+\gamma_{sag\,tr}\,P_{sn}(\theta_{tr},-10^{\circ})+
\gamma_{cor\,tr}\,P_d(\phi_{tr},-10^{\circ},10^{\circ})+\dots
\end{aligned}
\tag{5}
$$

---

# 5. Experiments
## 5.1 Simulation (6 daily poses)
* **Mean MPJPE**: 0.097 m  
* **Mean joint‑angle error**: 10.0°

## 5.2 Real‑world Tests
* Standing→squat, gymnastics, and sudden fall sequences.  
* Sagittal hip & knee angles matched ground‑truth trends (0→100° knee flexion during squat).

## 5.3 Runtime on Intel NUC‑11 (no GPU)
| max row | restarts | loss ($\times10^{-3}$) | time / frame |
|:------:|:-------:|:---------------------:|:------------:|
| **6** | **6** | **7.04** | **0.033 s** |

(10 fps camera → real‑time feasible).

---

# 6. Key Results
1. **Accuracy** – sub‑10 cm MPJPE with no 3‑D training data.  
2. **Efficiency** – 33 ms/frame optimisation on CPU‑only SBC.  
3. **Robustness** – depth ambiguity mitigated via CoM term; rare poses (falls) recovered.

---

# 7. Contributions
1. **Augmented humanoid model** (23 DOF with lumbar joint).  
2. **Novel loss design** – incorporates CoM balance + joint‑range penalties.  
3. **GPU‑free pipeline** – combines MediaPipe 2‑D with uDEAS to lift to 3‑D in real time.

---

# 8. Limitations & Future Work
* Depth from MediaPipe still inaccurate.  
* Current optimisation ignores wrists/ankles → extend DOF.  
* Plan to build action‑angle database for worker safety & Parkinson monitoring.
