import type {IFramework} from "ris-framework";

/**
 * KTX2 texture as created by ris-framework's own ktx2Factory.
 *
 * The framework and the viewer's encoder now share one ris-ktx2 (0.2.0, deduped), but the encoder still
 * hands over KTX2 file bytes and the framework loads them (see Ktx2Converter); keep it that way so the
 * displayed texture is always the one the framework created.
 * Use this type for every texture that is loaded, displayed or stored in the texture list.
 */
export type FrameworkKtx2Texture = ReturnType<NonNullable<IFramework["ktx2Factory"]>["createFromBuffer"]>;
