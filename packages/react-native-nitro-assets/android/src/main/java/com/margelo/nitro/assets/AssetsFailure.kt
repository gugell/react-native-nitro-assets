package com.margelo.nitro.assets

/**
 * A coded failure. Nitro rejects the JavaScript promise with this exception's message, so the code
 * travels in a fixed prefix the TypeScript layer parses: `[nitro-assets:<code>] message`.
 */
internal class AssetsFailure(
  val code: AssetsFailureCode,
  val reason: String,
  cause: Throwable? = null,
) : Exception("[nitro-assets:${code.value}] $reason", cause) {
  companion object
}
