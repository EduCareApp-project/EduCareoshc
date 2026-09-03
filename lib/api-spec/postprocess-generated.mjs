import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiSpecDir = path.dirname(fileURLToPath(import.meta.url));
const generatedClientPath = path.resolve(
  apiSpecDir,
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);

const generatedClient = await readFile(generatedClientPath, "utf8");

const generatedQueryOptions = `>(
  params?: ListPostsParams,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof listPosts>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};`;

const compatibleQueryOptions = `>(options?: {
  params?: ListPostsParams;
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof listPosts>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}) => {
  const { params, query: queryOptions, request: requestOptions } = options ?? {};`;

const generatedHook = `>(
  params?: ListPostsParams,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof listPosts>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getListPostsQueryOptions(params, options);`;

const compatibleHook = `>(options?: {
  params?: ListPostsParams;
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof listPosts>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getListPostsQueryOptions(options);`;

if (!generatedClient.includes(generatedQueryOptions)) {
  throw new Error(
    "Unable to preserve the list-post query options contract: generated query options shape changed.",
  );
}

if (!generatedClient.includes(generatedHook)) {
  throw new Error(
    "Unable to preserve the list-post hook contract: generated hook shape changed.",
  );
}

const compatibleClient = generatedClient
  .replace(generatedQueryOptions, compatibleQueryOptions)
  .replace(generatedHook, compatibleHook);

await writeFile(generatedClientPath, compatibleClient);