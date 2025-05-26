import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import { Constants } from "./constants";
import type { AoFetchResponse } from "ao-fetch";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string) {
  return address.slice(0, 5) + "..." + address.slice(-5)
}

export class Logger {
  static info(identifier: string, res: AoFetchResponse) {
    console.info(`[${identifier}]`, JSON.stringify(res.text ?? res.json))
  }

  static error(identifier: string, res: AoFetchResponse) {
    throw new Error(`[${identifier}|${res.status}]\n${JSON.stringify(res.error ?? res.json ?? res.text)}`)
  }
}

export function fileToUint8Array(file: File) {
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  return new Uint8Array(reader.result as ArrayBuffer);
}

export async function uploadFileAR(file: File, jwk?: JWKInterface) {
  const ar = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const data = fileToUint8Array(file);
  const tx = await ar.createTransaction({ data }, jwk ?? "use_wallet");

  tx.addTag("Content-Type", file.type);
  tx.addTag("Content-Length", data.length.toString());
  tx.addTag("Name", file.name);
  tx.addTag(Constants.TagNames.AppName, Constants.TagValues.AppName);
  tx.addTag(Constants.TagNames.AppVersion, Constants.TagValues.AppVersion);
  tx.addTag(Constants.TagNames.SubspaceFunction, Constants.TagValues.UploadFileAR);

  await ar.transactions.sign(tx, jwk ?? "use_wallet");
  const res = await ar.transactions.post(tx);

  if (res.status == 200) {
    return res.data.id;
  } else {
    Logger.error("uploadFileAR", { json: res });
  }
}

export function uploadFileTurbo(file: File) {
}