# API Flow Documentation

本文件說明 **用戶操作流程** 與 **API 調用** 之間的對應關係。

完整的用戶流程請參考 [USER_FLOW.md](./USER_FLOW.md)。

---

## 目錄

1. [登入 & 角色確認](#1-登入--角色確認)
2. [建立 Earn-out Deal](#2-建立-earn-out-deal)
3. [設定 Earn-out 參數](#3-設定-earn-out-參數)
4. [上傳營運資料](#4-上傳營運資料)
5. [查看資料時間線](#5-查看資料時間線)
6. [Buyer 提出 KPI](#6-buyer-提出-kpi)
7. [Auditor 驗證 KPI](#7-auditor-驗證-kpi)
8. [執行 Settlement](#8-執行-settlement)
9. [Dashboard 總覽](#9-dashboard-總覽)

---

## 1. 登入 & 角色確認

### 用戶行為
使用者用 Sui 錢包（如 Slush）連線並簽署訊息，進入系統查看自己的 deals。

### API 調用流程

#### 1.1 列出用戶的所有 Deals

**Endpoint**: `GET /deals`

**Request Headers**:
```http
X-Sui-Address: 0xabcd1234...
X-Sui-Signature: <signature>
```

**Query Parameters** (optional):
```
role=buyer          # 只顯示 buyer 角色的 deals
status=active       # 只顯示 active 狀態
```

**Response**:
```json
{
  "items": [
    {
      "dealId": "0x1234...",
      "name": "Acquisition of TechCorp Inc.",
      "status": "active",
      "userRole": "buyer",        // 當前用戶在此 deal 的角色
      "periodCount": 3,
      "settledPeriods": 1,
      "lastActivity": "2026-03-15T09:30:00Z"
    }
  ],
  "total": 2,
  "hasMore": false
}
```

**前端邏輯**:
- 根據 `userRole` 顯示不同的操作按鈕
- Buyer: 可建立新 deal、上傳資料、提報 KPI、結算
- Seller: 只能查看資料和結算結果
- Auditor: 可審核 KPI

---

## 2. 建立 Earn-out Deal

### 用戶行為
買方管理者按下「建立新 Deal」，填寫 deal 名稱、closing date、貨幣等資訊。

### API 調用流程

#### 2.1 建立新 Deal

**Endpoint**: `POST /deals`

**Request**:
```json
{
  "name": "Acquisition of TechCorp Inc.",
  "closingDate": "2025-12-31",
  "currency": "USD",
  "buyerAddress": "0xabcd...",
  "sellerAddress": "0xef01...",
  "auditorAddress": "0x9876...",
  "metadata": {
    "industry": "Technology",
    "dealSize": "50M USD"
  }
}
```

**Response**:
```json
{
  "deal": {
    "dealId": "0x1234...",
    "name": "Acquisition of TechCorp Inc.",
    "status": "draft",
    "buyer": "0xabcd...",
    "seller": "0xef01...",
    "auditor": "0x9876...",
    "periods": [],
    "createdAt": "2025-11-16T10:00:00Z"
  },
  "transaction": {
    "txBytes": "AAACAAgA...",
    "description": "Create earn-out deal: Acquisition of TechCorp Inc.",
    "estimatedGas": 1000000
  }
}
```

**前端邏輯**:
1. 收到 response 後，使用 `@mysten/dapp-kit` 讓用戶簽署 transaction
2. 簽署完成後，Deal 在 Sui 區塊鏈上創建成功
3. 監聽 `DealCreated` event 確認交易完成
4. 跳轉到 deal 詳情頁

**Sui 整合**:
- 調用 Move 合約: `earnout::create_deal()`
- 創建 on-chain Deal object
- 初始化 Seal policy for access control

---

## 3. 設定 Earn-out 參數

### 用戶行為
Buyer 進入「Earn-out 設定」頁面，設定期間、KPI 類型、門檻和計算公式。

### API 調用流程

#### 3.1 設定參數並鎖定

**Endpoint**: `POST /deals/{dealId}/parameters`

**Request**:
```json
{
  "periods": [
    {
      "name": "2026 Fiscal Year",
      "startDate": "2026-01-01",
      "endDate": "2026-12-31",
      "kpiTypes": [
        {
          "type": "revenue",
          "threshold": 10000000,
          "unit": "USD",
          "description": "Total revenue recognized in FY2026"
        }
      ],
      "formula": {
        "type": "linear",
        "maxPayout": 5000000,
        "parameters": {
          "minKPI": 10000000,
          "maxKPI": 15000000,
          "minPayout": 0,
          "maxPayout": 5000000
        },
        "description": "Linear payout from $0 to $5M as revenue grows from $10M to $15M"
      }
    }
  ]
}
```

**Response**:
```json
{
  "parameters": {
    "periods": [...]
  },
  "summary": "Period 1 (2026): If Revenue ≥ $10M, earn-out up to $5M (linear formula)",
  "transaction": {
    "txBytes": "...",
    "description": "Lock earn-out parameters for deal",
    "warning": "WARNING: Once locked, these parameters cannot be changed without mutual agreement",
    "estimatedGas": 2000000
  }
}
```

**前端邏輯**:
1. 顯示 `summary` 給用戶確認
2. 顯示 `warning` 警告（參數鎖定後不可更改）
3. 用戶確認後簽署 transaction
4. Deal status 變為 "active"

**Sui 整合**:
- 調用 `earnout::set_parameters()`
- 參數編碼為 Move structs 寫入鏈上
- Deal status: draft → active

---

## 4. 上傳營運資料

### 用戶行為
Buyer 財務團隊定期上傳財務文件（revenue journal、EBITDA report 等）。

### API 調用流程

#### 4.1 加密並上傳檔案到 Walrus

**Endpoint**: `POST /walrus/upload`

**前端準備工作** (在調用 API 前):
```typescript
import { seal } from '@mysten/seal';

// 1. 用戶選擇檔案
const file = event.target.files[0];

// 2. 使用 Seal 加密
const encryptedFile = await seal.encrypt(file, {
  dealId: "0x1234...",
  periodId: "period_2026"
});
```

**Request** (multipart/form-data):
```
file: <encrypted binary data>
dealId: 0x1234...
periodId: period_2026
dataType: revenue_journal
filename: revenue_q1_2026.csv
description: Q1 2026 revenue journal
```

**Response**:
```json
{
  "blobId": "blob_2Nf8pQz3Xm7Yk5Rd9Wv1Bc6Lt4Hs",
  "commitment": "sha256:a1b2c3d4...",
  "size": 2048576,
  "uploadedAt": "2026-03-15T09:30:00Z",
  "nextStep": {
    "action": "register_on_chain",
    "description": "Sign transaction to register this blob on-chain",
    "transaction": {
      "txBytes": "...",
      "description": "Register Walrus blob: revenue_journal for period_2026"
    }
  }
}
```

**前端邏輯**:
1. 前端用 Seal 加密檔案
2. 調用 Upload Relay API 上傳 ciphertext
3. 收到 blobId 後，簽署 transaction 將 blob 註冊到 Sui 鏈上
4. Blob 綁定到對應的 Deal/Period

**Walrus 整合**:
- Backend relay 使用 `@mysten/walrus` SDK 上傳
- 減少瀏覽器負擔（~2000 requests → 1 API call）
- 只存儲加密的 ciphertext

**Seal 整合**:
- 前端加密：確保 Walrus 上永遠是 ciphertext
- Access control：只有 buyer/seller/auditor 可解密
- Policy 在 Sui 上：`earnout_seal_policy`

---

## 5. 查看資料時間線

### 用戶行為
Buyer、Seller 或 Auditor 查看某個 deal 的所有資料上傳記錄。

### API 調用流程

#### 5.1 取得資料時間線

**Endpoint**: `GET /deals/{dealId}/timeline`

**Query Parameters**:
```
periodId=period_2026       # 篩選特定期間
dataType=revenue_journal   # 篩選資料類型
startDate=2026-01-01
endDate=2026-12-31
limit=20
offset=0
```

**Response**:
```json
{
  "items": [
    {
      "timestamp": "2026-03-15T09:30:00Z",
      "dataType": "revenue_journal",
      "periodId": "period_2026",
      "periodName": "2026 Fiscal Year",
      "blobId": "blob_2Nf8pQz3Xm7Yk5Rd9Wv1Bc6Lt4Hs",
      "size": 2048576,
      "filename": "revenue_q1_2026.csv",
      "submittedBy": "0xabcd...",
      "description": "Q1 2026 revenue journal"
    },
    // ... more entries
  ],
  "total": 5,
  "hasMore": false
}
```

**前端邏輯**:
- 顯示時間軸 UI
- Seller 可監控 buyer 是否按時提交資料
- 點擊 blob 可觸發下載（需透過 Seal 解密）

**下載 & 解密流程** (前端):
```typescript
// 1. 從 Walrus 下載 ciphertext
const ciphertext = await walrus.download(blobId);

// 2. 使用 Seal 請求解密 key
const decryptionKey = await seal.requestKey({
  blobId,
  dealId,
  periodId,
  userAddress // 當前用戶地址
});

// 3. Seal Key Servers 檢查 earnout_seal_policy
// 4. 如果用戶有權限（buyer/seller/auditor），返回 key
// 5. 前端解密
const plaintext = await seal.decrypt(ciphertext, decryptionKey);
```

---

## 6. Buyer 提出 KPI

### 用戶行為
Period 結束後，Buyer 計算 KPI 並提出結果。

### API 調用流程

#### 6.1 提報 KPI

**Endpoint**: `POST /deals/{dealId}/periods/{periodId}/kpi/propose`

**Request**:
```json
{
  "kpiType": "revenue",
  "value": 11300000,
  "unit": "USD",
  "notes": "Based on audited financial statements for FY2026",
  "supportingBlobIds": [
    "blob_2Nf8pQz3Xm7Yk5Rd9Wv1Bc6Lt4Hs",
    "blob_3Og9qRa4Yn8Zl6Se0Xw2Cd7Mu5It",
    "blob_4Ph0rSb5Zo9Am7Tf1Yx3De8Nv6Ju",
    "blob_5Qi1tTc6Ap0Bn8Ug2Zy4Ef9Ow7Kv"
  ]
}
```

**Response**:
```json
{
  "proposal": {
    "kpiType": "revenue",
    "value": 11300000,
    "proposedBy": "0xabcd...",
    "proposedAt": "2027-01-15T10:00:00Z",
    "status": "pending",
    "calculatedPayout": 2600000
  },
  "calculatedPayout": {
    "kpiValue": 11300000,
    "threshold": 10000000,
    "maxPayout": 5000000,
    "calculatedAmount": 2600000,
    "formula": "Linear: (11.3M - 10M) / (15M - 10M) * 5M = 2.6M"
  },
  "transaction": {
    "txBytes": "...",
    "description": "Propose KPI: Revenue = $11,300,000",
    "estimatedGas": 1500000
  }
}
```

**前端邏輯**:
1. 顯示計算出的 payout preview 給 buyer 確認
2. 顯示公式說明確保 buyer 理解計算方式
3. 用戶確認後簽署 transaction
4. KPI proposal 寫入鏈上

**Sui 整合**:
- 調用 `earnout::propose_kpi(deal, period, value)`
- Period status: data_collection → kpi_proposed
- Emit `KPIProposed` event

---

## 7. Auditor 驗證 KPI

### 用戶行為
Auditor 查看 KPI proposal，下載並驗證相關的財務文件，然後簽章確認。

### API 調用流程

#### 7.1 查看 KPI 提案（可選，Dashboard 中也有）

**Endpoint**: `GET /deals/{dealId}/dashboard`

查看該 period 的 KPI status

#### 7.2 驗證並簽章 KPI

**Endpoint**: `POST /deals/{dealId}/periods/{periodId}/kpi/attest`

**前端準備工作** (Auditor 先下載並驗證文件):
```typescript
// 1. 從 timeline 取得 supportingBlobIds
const blobs = proposal.supportingBlobIds;

// 2. 逐一下載並解密驗證
for (const blobId of blobs) {
  const ciphertext = await walrus.download(blobId);
  const plaintext = await seal.decrypt(ciphertext,
    await seal.requestKey({blobId, dealId, userAddress})
  );

  // 3. Auditor 用本地工具驗證內容
  await verifyFinancialData(plaintext);
}
```

**Request** (Approve):
```json
{
  "kpiType": "revenue",
  "value": 11300000,
  "approved": true,
  "notes": "Verified all revenue journals. Calculations are accurate.",
  "verifiedBlobIds": [
    "blob_2Nf8pQz3Xm7Yk5Rd9Wv1Bc6Lt4Hs",
    "blob_3Og9qRa4Yn8Zl6Se0Xw2Cd7Mu5It"
  ]
}
```

**Request** (Reject):
```json
{
  "kpiType": "revenue",
  "value": 11300000,
  "approved": false,
  "notes": "Discrepancy found in Q3 revenue. Missing $500K documentation."
}
```

**Response**:
```json
{
  "attestation": {
    "kpiType": "revenue",
    "attestedValue": 11300000,
    "attestedBy": "0x9876...",
    "attestedAt": "2027-02-01T14:30:00Z",
    "approved": true,
    "finalPayout": 2600000
  },
  "transaction": {
    "txBytes": "...",
    "description": "Attest KPI: Revenue = $11,300,000 (Approved)",
    "estimatedGas": 1800000
  }
}
```

**前端邏輯**:
1. Auditor 確認驗證結果後簽署 transaction
2. 如果 approved: Period status → kpi_attested，可以結算
3. 如果 rejected: Buyer 需要重新提報或補充資料

**Sui 整合**:
- 調用 `earnout::attest_kpi(deal, period, value, approved)`
- 只有 auditor 地址可以調用
- Emit `KPIAttested` event

**Seal 整合**:
- Auditor 透過 Seal 解密所有 supportingBlobIds
- Policy 確保 auditor 角色有解密權限

---

## 8. 執行 Settlement

### 用戶行為
KPI 被 auditor 確認後，Buyer 可以執行結算，支付 earn-out 給 seller。

### API 調用流程

#### 8.1 執行結算

**Endpoint**: `POST /deals/{dealId}/periods/{periodId}/settle`

**Request**:
```json
{
  "confirmedPayout": 2600000  // 必須與計算金額一致
}
```

**Response**:
```json
{
  "settlement": {
    "periodId": "period_2026",
    "periodName": "2026 Fiscal Year",
    "attestedKPI": 11300000,
    "calculatedPayout": 2600000,
    "recipient": "0xef01..."  // seller address
  },
  "transaction": {
    "txBytes": "...",
    "description": "Settle period_2026: Pay $2,600,000 to seller",
    "warning": "This settlement is irreversible. Please verify the amount.",
    "estimatedGas": 2500000,
    "tokenTransfer": {
      "amount": 2600000,
      "currency": "USD",
      "from": "0x_treasury...",
      "to": "0xef01..."
    }
  }
}
```

**前端邏輯**:
1. 顯示結算金額和 warning
2. 用戶再次確認後簽署 transaction
3. 交易執行：從 escrow 轉帳到 seller
4. Period status → settled

**Sui 整合**:
- 調用 `earnout::settle(deal, period)`
- 驗證 KPI 已被 attested
- 執行 token transfer（demo 可選）
- Period status: kpi_attested → settled
- Emit `PeriodSettled` event

---

## 9. Dashboard 總覽

### 用戶行為
打開某個 deal 的首頁，查看整體進度和健康狀態。

### API 調用流程

#### 9.1 取得 Dashboard 數據

**Endpoint**: `GET /deals/{dealId}/dashboard`

**Response**:
```json
{
  "dealInfo": {
    "dealId": "0x1234...",
    "name": "Acquisition of TechCorp Inc.",
    "status": "active",
    "roles": {
      "buyer": "0xabcd...",
      "seller": "0xef01...",
      "auditor": "0x9876..."
    },
    "userRole": "buyer"
  },
  "periodsSummary": [
    {
      "periodId": "period_2026",
      "name": "2026 Fiscal Year",
      "dateRange": {"start": "2026-01-01", "end": "2026-12-31"},
      "dataUploadProgress": {
        "blobCount": 5,
        "lastUploadAt": "2026-12-28T10:30:00Z",
        "completeness": 100
      },
      "kpiStatus": "approved",
      "kpiValue": 11300000,
      "settlementStatus": "settled",
      "settlementAmount": 2600000
    },
    {
      "periodId": "period_2027",
      "name": "2027 Fiscal Year",
      "dateRange": {"start": "2027-01-01", "end": "2027-12-31"},
      "dataUploadProgress": {
        "blobCount": 3,
        "completeness": 60
      },
      "kpiStatus": "not_proposed",
      "settlementStatus": "not_settled",
      "nextAction": {
        "action": "Continue uploading data",
        "actor": "buyer",
        "deadline": "2027-12-31"
      }
    }
  ],
  "recentEvents": [
    {
      "type": "settlement",
      "timestamp": "2027-02-15T14:30:00Z",
      "actor": "0xabcd...",
      "actorRole": "buyer",
      "description": "Settled period_2026: $2,600,000 paid to seller",
      "txHash": "8vqKfZTqP9J3xYz1RmN2BcD4LpW7Qh5K"
    },
    {
      "type": "kpi_attested",
      "timestamp": "2027-02-01T14:30:00Z",
      "actor": "0x9876...",
      "actorRole": "auditor",
      "description": "Auditor approved KPI for period_2026: Revenue = $11,300,000",
      "txHash": "9wqLfZUqP9K3xYz1RnN2BcE4MpX7Ri5L"
    }
  ],
  "healthMetrics": {
    "overallProgress": 55.5,
    "pendingActions": 2,
    "nextDeadline": "2027-12-31",
    "dataCompletenessScore": 53.3,
    "risksDetected": [
      {
        "severity": "medium",
        "category": "Incomplete Data",
        "description": "Period 2027 data completeness is 60%",
        "periodId": "period_2027"
      }
    ]
  }
}
```

**前端邏輯**:
- 顯示 deal 整體狀態
- 每個 period 的進度卡片
- 最近活動時間線
- 根據 `nextAction` 顯示待辦事項
- 風險警告（資料不完整、逾期等）

---

## 完整流程圖

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Connect Wallet & List Deals                              │
│    GET /deals?role=buyer                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Create Deal (Buyer)                                      │
│    POST /deals                                              │
│    → Sign Sui TX → Deal created on-chain                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Set Parameters (Buyer)                                   │
│    POST /deals/{dealId}/parameters                         │
│    → Sign Sui TX → Parameters locked on-chain              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Upload Data (Buyer, periodically)                        │
│    Frontend: Seal.encrypt(file) → ciphertext               │
│    POST /walrus/upload (ciphertext)                        │
│    → Walrus stores encrypted file                          │
│    → Sign Sui TX to register blobId                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. View Timeline (All roles)                                │
│    GET /deals/{dealId}/timeline                            │
│    → Shows all uploaded blobs                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Propose KPI (Buyer, after period ends)                   │
│    POST /deals/{dealId}/periods/{periodId}/kpi/propose     │
│    → Backend calculates payout preview                     │
│    → Sign Sui TX → KPI proposal on-chain                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Attest KPI (Auditor)                                     │
│    Frontend: Download blobs → Seal.decrypt → Verify        │
│    POST /deals/{dealId}/periods/{periodId}/kpi/attest      │
│    → Sign Sui TX → KPI attested on-chain                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Settle (Buyer)                                            │
│    POST /deals/{dealId}/periods/{periodId}/settle          │
│    → Sign Sui TX → Transfer funds to seller                │
│    → Period marked as settled                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Dashboard (All roles, anytime)                           │
│    GET /deals/{dealId}/dashboard                           │
│    → Aggregated view of all periods and events             │
└─────────────────────────────────────────────────────────────┘
```

---

## 關鍵整合點

### Sui 區塊鏈
- **Write Operations**: 所有 POST 操作都會返回 unsigned transaction
- **Frontend 職責**: 使用 `@mysten/dapp-kit` 讓用戶簽署交易
- **Events**: 監聽 Sui events 確認交易完成
- **Gas**: 每個操作都有 gas 估算

### Walrus 儲存
- **Upload Relay**: 後端處理 ~2000 requests，前端只需一次 API 調用
- **Encryption First**: 前端必須先用 Seal 加密，再上傳
- **Blob Registration**: 上傳後必須在 Sui 鏈上註冊 blobId

### Seal 加密
- **前端加密**: `seal.encrypt()` 在上傳前
- **前端解密**: `seal.decrypt()` 在下載後
- **Access Control**: Seal Key Servers 檢查 `earnout_seal_policy` on Sui
- **Role Verification**: 只有 buyer/seller/auditor 可以解密

---

## 認證機制

所有 API 請求都需要以下 headers:

```http
X-Sui-Address: 0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890
X-Sui-Signature: <signature_proving_ownership>
```

**生成簽名** (前端範例):
```typescript
import { useSignPersonalMessage } from '@mysten/dapp-kit';

const { mutate: signMessage } = useSignPersonalMessage();

signMessage({
  message: 'Authenticate to M&A Earn-out API',
}, {
  onSuccess: (signature) => {
    // Use signature in X-Sui-Signature header
  }
});
```

---

## 錯誤處理

所有 API 都遵循統一的錯誤格式:

```json
{
  "error": "ValidationError",
  "message": "Period already settled",
  "statusCode": 409,
  "details": {
    "settledAt": "2027-02-15T14:30:00Z",
    "amount": 2600000
  }
}
```

常見錯誤碼:
- `400`: 驗證錯誤（參數不正確）
- `401`: 未認證（缺少 signature）
- `403`: 無權限（角色不符）
- `404`: 資源不存在
- `409`: 衝突（如重複結算）

---

## 開發建議

1. **先看 Dashboard**: 從 `/deals/{dealId}/dashboard` 開始，了解整體狀態
2. **按順序開發**: 依照用戶流程順序實作功能
3. **測試工具**: 使用 Swagger UI (`/api-docs`) 測試 API
4. **監聽 Events**: 善用 Sui events 追蹤鏈上狀態變化
5. **錯誤處理**: 每個步驟都要處理失敗情況（TX 失敗、網路錯誤等）

---

## 相關文件

- [USER_FLOW.md](./USER_FLOW.md) - 詳細的用戶操作流程
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - 後端開發指南
- [TECH_STACK.md](./TECH_STACK.md) - 技術棧說明
- [OpenAPI Spec](http://localhost:3000/api/openapi) - 完整的 API 規格
- [Swagger UI](http://localhost:3000/api-docs) - 互動式 API 文檔
