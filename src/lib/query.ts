/**
 * A load failed and there is nothing to show. A refetch that fails (a pull,
 * coming back to the app on weak signal) keeps the last good data on screen
 * instead of swapping the whole screen for an error: TanStack Query keeps
 * that data, so only a first load that fails is an error screen.
 */
export const failedToLoad = (query: { isError: boolean; data: unknown }) => query.isError && query.data === undefined;
