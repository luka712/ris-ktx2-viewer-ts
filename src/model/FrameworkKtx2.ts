import type {IFramework} from "ris-framework";

/**
 * KTX2 texture as created by ris-framework's own ktx2Factory.
 *
 * ris-framework bundles ris-ktx2 0.1.0, while the viewer's encoder uses ris-ktx2 0.2.x
 * (for compressAstc). The two IKtx2Texture types differ, so objects never cross between them:
 * the encoder hands over KTX2 file bytes and the framework loads them (see Ktx2Converter).
 * Use this type for every texture that is loaded, displayed or stored in the texture list.
 */
export type FrameworkKtx2Texture = ReturnType<NonNullable<IFramework["ktx2Factory"]>["createFromBuffer"]>;
