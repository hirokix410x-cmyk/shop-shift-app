import { normalizePrivateKey } from "./googleSheets";

const PREFIX = "[/api/shifts]";

type PrivateKeyLogFields = {
  isDefined: boolean;
  /** 環境変数の生の文字列長（中身はログに出さない） */
  rawCharLength: number;
  /** `\\n` → 改行 後の文字数 */
  normalizedCharLength: number;
  /** 生の文字列に `\\`+`n` 連続が含まれる（JSON由来の改行） */
  containsEscapedNewlineSequence: boolean;
  /** 正規化後に実改行を含むか */
  hasActualNewlinesAfterNormalize: boolean;
  hasBeginPemLine: boolean;
  hasEndPemLine: boolean;
  lineCountAfterNormalize: number;
  looksLikeWellFormedPem: boolean;
};

/**
 * 秘密鍵の本文は出さず、パース状況だけ返す（Vercel ログ用）
 */
export function describePrivateKeyForLog(
  raw: string | undefined,
): PrivateKeyLogFields {
  if (raw == null || raw === "") {
    return {
      isDefined: false,
      rawCharLength: 0,
      normalizedCharLength: 0,
      containsEscapedNewlineSequence: false,
      hasActualNewlinesAfterNormalize: false,
      hasBeginPemLine: false,
      hasEndPemLine: false,
      lineCountAfterNormalize: 0,
      looksLikeWellFormedPem: false,
    };
  }
  const normalized = normalizePrivateKey(raw);
  const hasBegin = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
    normalized,
  );
  const hasEnd = /-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(normalized);
  const lines = normalized.split("\n").length;
  const well =
    hasBegin &&
    hasEnd &&
    normalized.trim().length > 80;
  return {
    isDefined: true,
    rawCharLength: raw.length,
    normalizedCharLength: normalized.length,
    containsEscapedNewlineSequence: /\\n/.test(raw),
    hasActualNewlinesAfterNormalize: normalized.includes("\n"),
    hasBeginPemLine: hasBegin,
    hasEndPemLine: hasEnd,
    lineCountAfterNormalize: lines,
    looksLikeWellFormedPem: well,
  };
}

type EnvSnapshot = {
  hasServiceAccountEmail: boolean;
  hasPrivateKey: boolean;
  hasSheetId: boolean;
  serviceAccountEmailPrefix: string | null;
  sheetIdLength: number;
};

function envSnapshot(): EnvSnapshot {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  return {
    hasServiceAccountEmail: Boolean(email),
    hasPrivateKey:
      process.env.GOOGLE_PRIVATE_KEY != null && process.env.GOOGLE_PRIVATE_KEY !== "",
    hasSheetId: Boolean(process.env.GOOGLE_SHEET_ID?.trim()),
    serviceAccountEmailPrefix: email
      ? email.length <= 3
        ? "***"
        : `${email.slice(0, 3)}…`
      : null,
    sheetIdLength: (process.env.GOOGLE_SHEET_ID ?? "").trim().length,
  };
}

function httpStatusFromUnknown(e: unknown): number | undefined {
  if (e && typeof e === "object") {
    if ("status" in e && typeof (e as { status: unknown }).status === "number") {
      return (e as { status: number }).status;
    }
    if ("code" in e && typeof (e as { code: unknown }).code === "number") {
      const c = (e as { code: number }).code;
      if (c >= 100 && c < 600) return c;
    }
    if ("response" in e) {
      const r = (e as { response?: { status?: number } }).response;
      if (r?.status != null) return r.status;
    }
  }
  if (e instanceof Error) {
    const br = e.message.match(/\[(\d{3})\]/);
    if (br) {
      const n = parseInt(br[1], 10);
      if (n >= 100 && n < 600) {
        return n;
      }
    }
    if (
      /Quota exceeded|rateLimitExceeded|Too Many Requests|RESOURCE_EXHAUSTED|User-rate limit exceeded/i.test(
        e.message,
      )
    ) {
      return 429;
    }
  }
  return undefined;
}

function pickGoogleApiMessage(e: unknown): string | undefined {
  if (e && typeof e === "object" && "response" in e) {
    const d = (e as { response?: { data?: unknown } }).response?.data;
    if (d && typeof d === "object" && d !== null) {
      const err = (d as { error?: { message?: string } }).error;
      if (err?.message) return err.message;
    }
  }
  return undefined;
}

export type ClientSheetErrorPayload = {
  error: string;
  hint?: string;
  errorCode?: string;
};

/**
 * サーバー専用: 接続失敗の詳細を console.error へ
 */
export function logShiftsConnectionFailure(
  method: "GET" | "POST" | "PATCH",
  operation: "load" | "save" | "parse_body" | "validate",
  err: unknown,
): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const http = httpStatusFromUnknown(err);
  const apiMsg = pickGoogleApiMessage(err);
  const env = envSnapshot();
  const keyDiag = describePrivateKeyForLog(process.env.GOOGLE_PRIVATE_KEY);
  const cause =
    e instanceof Error && "cause" in e && e.cause != null
      ? e.cause instanceof Error
        ? e.cause.message
        : String(e.cause)
      : undefined;

  console.error(
    `${PREFIX} ${method} 失敗`,
    JSON.stringify(
      {
        operation,
        errorName: e.name,
        errorMessage: e.message,
        cause,
        httpStatus: http,
        googleApiErrorMessage: apiMsg,
        env,
        privateKey: keyDiag,
        note: "privateKey には中身を出さず、パース診断のみ。hasBeginPemLine / looksLikeWellFormedPem を参照。",
      },
      null,
      2,
    ),
  );
}

/**
 * クライアント用 JSON: 秘匿を保ちつつ errorCode / hint
 */
export function toClientSheetErrorPayload(
  err: unknown,
  fallbackMessage: string,
): { status: number; payload: ClientSheetErrorPayload } {
  const e = err instanceof Error ? err : new Error(String(err));
  const msg = e.message;
  const http = httpStatusFromUnknown(err);
  const keyDiag = describePrivateKeyForLog(process.env.GOOGLE_PRIVATE_KEY);
  const suggestsKeyProblem =
    /PEM|private key|invalid key|decrypt|secretOrPrivateKey|UNABLE_TO_/i.test(msg);

  if (msg.includes("GOOGLE_SERVICE_ACCOUNT_EMAIL")) {
    return {
      status: 500,
      payload: {
        error: msg,
        errorCode: "ENV_MISSING_EMAIL",
        hint: "Vercel の Environment Variables に GOOGLE_SERVICE_ACCOUNT_EMAIL を設定し、再デプロイしてください。",
      },
    };
  }
  if (msg.includes("GOOGLE_PRIVATE_KEY")) {
    return {
      status: 500,
      payload: {
        error: msg,
        errorCode: "ENV_MISSING_KEY",
        hint: "Vercel に GOOGLE_PRIVATE_KEY を設定してください。1行化する場合は `\\n` を含め、コードの .replace(/\\\\n/g, '\\n') で実改行に戻す想定です。",
      },
    };
  }
  if (msg.includes("GOOGLE_SHEET_ID")) {
    return {
      status: 500,
      payload: {
        error: msg,
        errorCode: "ENV_MISSING_SHEET_ID",
        hint: "GOOGLE_SHEET_ID にはスプレッドシートの ID（URL の /d/ 直後の文字列）を設定します。",
      },
    };
  }

  if (
    keyDiag.isDefined &&
    !keyDiag.looksLikeWellFormedPem &&
    (suggestsKeyProblem || /invalid_grant|bad mac/i.test(msg))
  ) {
    return {
      status: 500,
      payload: {
        error: msg,
        errorCode: "PRIVATE_KEY_PEM_MALFORMED",
        hint: "秘密鍵が PEM として解釈できていない可能性があります。Vercel の Function ログの privateKey 診断（looksLikeWellFormedPem 等）を確認してください。",
      },
    };
  }

  if (http === 403) {
    return {
      status: 500,
      payload: {
        error: msg || "Google API が 403（権限不足）を返しました",
        errorCode: "GOOGLE_API_403",
        hint: "スプレッドシートを GOOGLE_SERVICE_ACCOUNT_EMAIL のアドレスに「編集者」で共有してください。",
      },
    };
  }
  if (http === 404) {
    return {
      status: 500,
      payload: {
        error: msg || "スプレッドシートが見つかりません (404)",
        errorCode: "SHEET_NOT_FOUND",
        hint: "GOOGLE_SHEET_ID が正しいか確認してください。",
      },
    };
  }
  if (http === 401) {
    return {
      status: 500,
      payload: {
        error: msg || "認証に失敗しました (401)",
        errorCode: "GOOGLE_AUTH_401",
        hint: "GOOGLE_SERVICE_ACCOUNT_EMAIL と GOOGLE_PRIVATE_KEY が同一サービスアカウントの組か確認してください。",
      },
    };
  }

  if (
    http === 429 ||
    /Quota exceeded|RESOURCE_EXHAUSTED|rate limit|Too many requests|User-rate limit/i.test(msg)
  ) {
    return {
      status: 429,
      payload: {
        error:
          msg && msg.length < 600
            ? msg
            : "Google Sheets API の利用上限（429: Read 回数/分 など）に達しました。",
        errorCode: "GOOGLE_API_429",
        hint:
          "短時間のリロードが続くと起きます。1分ほど待ってから再読み込みしてください。一覧の取得はサーバー側で短い間隔キャッシュします（環境変数 SHIFTS_LIST_CACHE_TTL_MS）。Google Cloud コンソール（APIs & Services）で Sheets API の Quotas 引き上げも可能です。",
      },
    };
  }

  if (/invalid_grant|invalid_argument/i.test(msg)) {
    return {
      status: 500,
      payload: {
        error: msg,
        errorCode: "AUTH_INVALID_GRANT",
        hint: "クレデンシャル（メール/鍵/プロジェクト）の不一致、またはキー再発行が必要な場合があります。",
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: msg && msg.length < 500 ? msg : fallbackMessage,
      errorCode: "UNKNOWN",
      hint: "Vercel の Runtime Logs に [/api/shifts] の詳細（privateKey 診断含む）が出ます。",
    },
  };
}
