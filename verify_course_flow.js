
const BASE_URL = 'http://localhost:5000/api';

const TRAINER_CREDENTIALS = {
    email: "trainer@urbancode.com",
    password: "Trainer@123"
};

async function runVerification() {
    console.log("Starting Verification...");

    // 1. Login
    console.log("1. Logging in...");
    let token;
    let trainerId;
    try {
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TRAINER_CREDENTIALS)
        });

        if (!loginRes.ok) {
            const err = await loginRes.text();
            throw new Error(`Login failed: ${loginRes.status} ${err}`);
        }

        const loginData = await loginRes.json();
        token = loginData.accessToken;
        trainerId = loginData.user.id;
        console.log("✅ Login successful");
    } catch (error) {
        console.error("❌ Login failed. Make sure the server is running and demo user exists.", error.message);
        // Fallback registration logic omitted for brevity as previous runs established it works/fails
        process.exit(1);
    }

    if (!token) {
        console.error("❌ No token obtained. Exiting.");
        process.exit(1);
    }

    // 2. Create Course
    console.log("2. Creating Course...");
    const originalName = "Versioning Test Course " + Date.now();
    const newCourse = {
        courseName: originalName,
        courseId: "VER_" + Date.now(),
        courseDescription: "Testing versioning.",
        courseDuration: 5,
        modules: []
    };

    let courseId;
    try {
        const createRes = await fetch(`${BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newCourse)
        });

        if (!createRes.ok) {
            const err = await createRes.text();
            throw new Error(`Create Course failed: ${createRes.status} ${err}`);
        }

        const createData = await createRes.json();
        courseId = createData._id;
        console.log("✅ Course created:", createData.courseName);
    } catch (error) {
        console.error("❌ Create Course failed:", error.message);
        process.exit(1);
    }

    // 3. Update Course (Should create Version 1 with originalName)
    console.log("3. Updating Course...");
    const updatedName = "Versioning Test Course UPDATED";
    try {
        const updateRes = await fetch(`${BASE_URL}/courses/${courseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ courseName: updatedName })
        });

        if (updateRes.ok) {
            const updatedData = await updateRes.json();
            if (updatedData.courseName === updatedName) {
                console.log("✅ Course updated successfully");
            } else {
                console.error("❌ Course update returned old name");
            }
        } else {
            console.error("❌ Update failed:", await updateRes.text());
        }
    } catch (error) {
        console.error("❌ Update error:", error.message);
    }

    // 4. Verify Version Creation
    console.log("4. Verifying Versions...");
    let versionIdToRollback;
    try {
        const verRes = await fetch(`${BASE_URL}/courses/${courseId}/versions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const versions = await verRes.json();
        console.log(`Found ${versions.length} versions.`);

        // We expect at least one version (Version 1) containing the original Name
        const v1 = versions.find(v => v.courseName === originalName);
        if (v1) {
            console.log("✅ Found version with original name.");
            versionIdToRollback = v1._id;
        } else {
            console.error("❌ Could not find version with original name.");
        }
    } catch (error) {
        console.error("❌ Verify Versions error:", error.message);
    }

    // 5. Rollback
    if (versionIdToRollback) {
        console.log("5. Rolling back...");
        try {
            const rollRes = await fetch(`${BASE_URL}/courses/${courseId}/rollback/${versionIdToRollback}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (rollRes.ok) {
                const rollData = await rollRes.json();
                if (rollData.course.courseName === originalName) {
                    console.log("✅ Rollback successful. Name restored.");
                } else {
                    console.error("❌ Rollback failed. Name mismatch:", rollData.course.courseName);
                }
            } else {
                console.error("❌ Rollback HTTP failed:", await rollRes.text());
            }

        } catch (error) {
            console.error("❌ Rollback error:", error.message);
        }
    }

    // 6. Cleanup (Delete Course)
    console.log("6. Deleting Course...");
    await fetch(`${BASE_URL}/courses/${courseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("✅ Cleanup complete");
}

runVerification();
