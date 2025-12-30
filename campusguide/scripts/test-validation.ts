
import { z } from "zod";

const ResourceTypes = {
    Video: "video",
    Pdf: "pdf",
    Summary: "summary",
} as const;

const schema = z
    .object({
        title: z.string().min(1).max(140).trim(),
        subject: z.string().min(1).max(80).trim(),
        academicYear: z.number().int().min(1).max(4),
        type: z.enum([ResourceTypes.Video, ResourceTypes.Pdf, ResourceTypes.Summary]),
        externalUrl: z.string().url(),
    })
    .strict();

const testCases = [
    {
        title: "Test",
        subject: "Math",
        academicYear: 1,
        type: "pdf",
        externalUrl: "https://google.com"
    },
    {
        title: "Test 2",
        subject: "Math",
        academicYear: 1,
        type: "pdf",
        externalUrl: "www.google.com"
    },
    {
        title: "Test 3",
        subject: "Math",
        academicYear: 1,
        type: "pdf",
        externalUrl: "google.com"
    }
];

testCases.forEach((data, i) => {
    const result = schema.safeParse(data);
    console.log(`Test Case ${i + 1}:`, result.success ? "Success" : result.error);
});
