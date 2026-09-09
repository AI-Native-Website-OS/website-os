package com.sinounion.util;

import java.io.IOException;
import java.io.InputStream;

/**
 * 仅解析图片头部获取宽高，避免整图解码。
 * 支持 JPEG / PNG / WebP。
 */
public class ImageDimensionReader {

    private ImageDimensionReader() {}

    public static class Dimension {
        public final int width;
        public final int height;
        public Dimension(int width, int height) {
            this.width = width;
            this.height = height;
        }
    }

    public static Dimension read(InputStream in) throws IOException {
        byte[] header = new byte[64];
        int read = in.read(header, 0, header.length);
        if (read < 12) return null;

        // PNG: 8-byte signature + IHDR, width(4)/height(4) big-endian at offset 16
        if (header[0] == (byte) 0x89 && header[1] == (byte) 0x50 && header[2] == (byte) 0x4E && header[3] == (byte) 0x47) {
            if (read < 24) return null;
            int w = ((header[16] & 0xFF) << 24) | ((header[17] & 0xFF) << 16) | ((header[18] & 0xFF) << 8) | (header[19] & 0xFF);
            int h = ((header[20] & 0xFF) << 24) | ((header[21] & 0xFF) << 16) | ((header[22] & 0xFF) << 8) | (header[23] & 0xFF);
            return (w > 0 && h > 0) ? new Dimension(w, h) : null;
        }

        // WebP: RIFF....WEBP
        if (header[0] == (byte) 'R' && header[1] == (byte) 'I' && header[2] == (byte) 'F' && header[3] == (byte) 'F'
                && header[8] == (byte) 'W' && header[9] == (byte) 'E' && header[10] == (byte) 'B' && header[11] == (byte) 'P') {
            return readWebp(header, read);
        }

        // JPEG: scan markers
        if (header[0] == (byte) 0xFF && header[1] == (byte) 0xD8) {
            return readJpeg(in, header, read);
        }

        return null;
    }

    private static Dimension readWebp(byte[] header, int read) {
        // 需要定位到第一个 chunk：12 字节 RIFF 头 + 4 字节 FourCC + 4 字节大小
        int chunkType = header[12] & 0xFF;
        int base = 20; // 数据起始
        if (read < base + 4) return null;

        boolean isVp8x = chunkType == 'X' && header[13] == (byte) '8' && header[14] == (byte) 'X';
        boolean isVp8l = chunkType == 'L' && header[13] == (byte) '8' && header[14] == (byte) 'L';
        boolean isVp8 = chunkType == ' ' && header[13] == (byte) '8' && header[14] == (byte) 'P' && header[15] == (byte) ' ';

        if (isVp8x) {
            // VP8X: 保留/标志 4 字节后为 24-bit 宽高-1（小端）
            if (read < base + 10) return null;
            int w = ((header[base + 4] & 0xFF) | ((header[base + 5] & 0xFF) << 8) | ((header[base + 6] & 0xFF) << 16)) + 1;
            int h = ((header[base + 7] & 0xFF) | ((header[base + 8] & 0xFF) << 8) | ((header[base + 9] & 0xFF) << 16)) + 1;
            return (w > 0 && h > 0) ? new Dimension(w, h) : null;
        }

        if (isVp8l) {
            // VP8L: 签名 0x2F，之后 14-bit 宽-1、高-1（小端跨字节）
            if (read < base + 5 || header[base] != (byte) 0x2F) return null;
            int wMinus1 = (header[base + 1] & 0xFF) | ((header[base + 2] & 0x3F) << 8);
            int hMinus1 = ((header[base + 2] & 0xFF) >> 6) | ((header[base + 3] & 0xFF) << 2) | ((header[base + 4] & 0x0F) << 10);
            int w = wMinus1 + 1;
            int h = hMinus1 + 1;
            return (w > 0 && h > 0) ? new Dimension(w, h) : null;
        }

        if (isVp8) {
            // VP8: 帧标签 3 字节同步码 0x9D 0x01 0x2A，之后 1 字节帧头，再 3 字节同步码，然后宽高（14-bit）
            if (read < base + 10) return null;
            if (!(header[base] == (byte) 0x9D && header[base + 1] == (byte) 0x01 && header[base + 2] == (byte) 0x2A)) return null;
            boolean keyFrame = (header[base + 3] & 0x01) == 0;
            if (!keyFrame) return null;
            if (!(header[base + 6] == (byte) 0x9D && header[base + 7] == (byte) 0x01 && header[base + 8] == (byte) 0x2A)) return null;
            int w = (header[base + 9] & 0xFF) | ((header[base + 10] & 0x3F) << 8);
            int h = (header[base + 11] & 0xFF) | ((header[base + 12] & 0x3F) << 8);
            return (w > 0 && h > 0) ? new Dimension(w, h) : null;
        }

        return null;
    }

    private static Dimension readJpeg(InputStream in, byte[] header, int initialRead) throws IOException {
        byte[] buf = new byte[16];
        // 从初始读取的头中先尝试
        Dimension d = scanJpegBuffer(header, initialRead);
        if (d != null) return d;

        int remaining = header.length;
        while (true) {
            int b = in.read();
            if (b == -1) return null;
            if (b == 0xFF) {
                int marker = in.read();
                if (marker == -1) return null;
                if (marker == 0xFF) continue; // 填充字节
                if (marker == 0xD8 || marker == 0xD9) continue;
                // SOF 标记（排除 DHT C4, JPG C8, DAC CC, RST D0-D7, SOI D8, EOI D9, SOS DA, DNL DC, DRI DD）
                boolean sof = marker >= 0xC0 && marker <= 0xCF
                        && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
                if (sof) {
                    int len1 = in.read();
                    int len2 = in.read();
                    if (len1 == -1 || len2 == -1) return null;
                    int segLen = (len1 << 8) | len2;
                    if (segLen < 7) return null;
                    byte[] seg = new byte[Math.min(segLen, buf.length)];
                    int n = 0;
                    while (n < seg.length) {
                        int r = in.read(seg, n, seg.length - n);
                        if (r == -1) break;
                        n += r;
                    }
                    if (n < 7) return null;
                    int h = ((seg[1] & 0xFF) << 8) | (seg[2] & 0xFF);
                    int w = ((seg[3] & 0xFF) << 8) | (seg[4] & 0xFF);
                    return (w > 0 && h > 0) ? new Dimension(w, h) : null;
                } else {
                    // 跳过段
                    int len1 = in.read();
                    int len2 = in.read();
                    if (len1 == -1 || len2 == -1) return null;
                    int segLen = (len1 << 8) | len2;
                    if (segLen < 2) return null;
                    long skipped = in.skip(segLen - 2);
                    while (skipped < segLen - 2) {
                        int r = (int) in.skip(segLen - 2 - skipped);
                        if (r <= 0) {
                            if (in.read() == -1) return null;
                            skipped += 1;
                        } else {
                            skipped += r;
                        }
                    }
                }
            }
        }
    }

    private static Dimension scanJpegBuffer(byte[] header, int len) {
        // 简单扫描已读缓冲区中的 SOF
        for (int i = 0; i + 9 < len; i++) {
            if ((header[i] & 0xFF) == 0xFF) {
                int marker = header[i + 1] & 0xFF;
                boolean sof = marker >= 0xC0 && marker <= 0xCF
                        && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
                if (sof && i + 9 < len) {
                    int h = ((header[i + 6] & 0xFF) << 8) | (header[i + 7] & 0xFF);
                    int w = ((header[i + 8] & 0xFF) << 8) | (header[i + 9] & 0xFF);
                    if (w > 0 && h > 0) return new Dimension(w, h);
                }
            }
        }
        return null;
    }
}
