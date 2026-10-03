import * as React from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Link,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';

const LINKS = {
    ktxSpec: 'https://github.khronos.org/KTX-Specification/ktxspec.v2.html',
    ktxJsWrappers: 'https://github.khronos.org/KTX-Software/ktxjswrappers/index.html',
    basisUniversal: 'https://github.com/BinomialLLC/basis_universal',
    khronos: 'https://www.khronos.org/',
    github: 'https://github.com/luka712/TypeScript-RisGameFramework',
};

function ExternalLink({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
        >
            {children}
        </Link>
    );
}

export default function AboutDialog() {
    const [open, setOpen] = React.useState(false);

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <>
            <Button variant="outlined" onClick={handleOpen}>
                See more
            </Button>

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth="md"
                fullScreen={fullScreen}
            >
                <DialogTitle>
                    About KTX2 Viewer
                </DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="body1" gutterBottom>
                                A free, browser-based{' '}
                                <strong>KTX2 viewer and converter</strong> for
                                working with GPU texture assets.
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                                No installation is required. Images and
                                textures can be processed directly in the
                                browser.
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                What it does
                            </Typography>

                            <Stack spacing={1}>
                                <Typography variant="body2">
                                    • Convert PNG and WebP images to{' '}
                                    <ExternalLink href={LINKS.ktxSpec}>
                                        KTX2
                                    </ExternalLink>{' '}
                                    textures.
                                </Typography>

                                <Typography variant="body2">
                                    • Compress textures using{' '}
                                    <ExternalLink href={LINKS.basisUniversal}>
                                        Basis Universal
                                    </ExternalLink>
                                    .
                                </Typography>

                                <Typography variant="body2">
                                    • Inspect existing <code>.ktx2</code> files
                                    directly in the browser.
                                </Typography>

                                <Typography variant="body2">
                                    • Inspect dimensions, mip levels,
                                    compression, supercompression, and other
                                    texture metadata.
                                </Typography>

                                <Typography variant="body2">
                                    • Preview GPU-compressed texture formats
                                    such as BC, ASTC, ETC2, and PVRTC.
                                </Typography>
                            </Stack>
                        </Box>

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                About KTX2
                            </Typography>

                            <Typography variant="body2">
                                <ExternalLink href={LINKS.ktxSpec}>
                                    KTX2
                                </ExternalLink>{' '}
                                is the Khronos texture container format designed
                                for efficient GPU texture distribution.
                            </Typography>

                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Together with{' '}
                                <ExternalLink href={LINKS.basisUniversal}>
                                    Basis Universal
                                </ExternalLink>
                                , KTX2 can provide compact, GPU-friendly
                                textures that can be transcoded at runtime to
                                formats supported by the target device.
                            </Typography>

                            <Typography variant="body2" sx={{ mt: 1 }}>
                                This makes KTX2 particularly useful for modern
                                graphics applications, game engines, WebGPU,
                                and WebGL.
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Technology &amp; Resources
                            </Typography>

                            <Stack spacing={1}>
                                <Typography variant="body2">
                                    <strong>KTX2 Specification:</strong>{' '}
                                    <ExternalLink href={LINKS.ktxSpec}>
                                        Khronos KTX Specification
                                    </ExternalLink>
                                </Typography>

                                <Typography variant="body2">
                                    <strong>JavaScript support:</strong>{' '}
                                    <ExternalLink href={LINKS.ktxJsWrappers}>
                                        KTX-Software JavaScript Wrappers
                                    </ExternalLink>
                                </Typography>

                                <Typography variant="body2">
                                    <strong>Texture compression:</strong>{' '}
                                    <ExternalLink href={LINKS.basisUniversal}>
                                        Basis Universal
                                    </ExternalLink>
                                </Typography>

                                <Typography variant="body2">
                                    <strong>Standards organization:</strong>{' '}
                                    <ExternalLink href={LINKS.khronos}>
                                        Khronos Group
                                    </ExternalLink>
                                </Typography>
                            </Stack>
                        </Box>

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Contact &amp; Source
                            </Typography>

                            <Stack spacing={1}>
                                <Typography variant="body2">
                                    <strong>Email:</strong>{' '}
                                    <Link href="mailto:erkapic.luka.dev@gmail.com">
                                        erkapic.luka.dev@gmail.com
                                    </Link>
                                </Typography>

                                <Typography variant="body2">
                                    <strong>Source code:</strong>{' '}
                                    <ExternalLink href={LINKS.github}>
                                        GitHub repository
                                    </ExternalLink>
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
