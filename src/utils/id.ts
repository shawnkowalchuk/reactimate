import { nanoid } from "nanoid";

export const newId = (prefix = ""): string =>
  prefix ? `${prefix}_${nanoid(10)}` : nanoid(10);
