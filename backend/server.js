const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt");
const secret = 'secret-sriram';


const app = express();

app.use(cors({
    origin: '*',
    credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
    console.log(req.path, req.method)
    next()
})

const mdb = 'mongodb+srv://sriramhlr:12345@sriram400.nv1eh.mongodb.net/?retryWrites=true&w=majority&appName=sriram400'
mongoose.connect(mdb)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

const Enquire = new mongoose.Schema({
    name: { type: String },
    email: { type: String },
    number: { type: Number },
    course: { type: String }
})

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    grade: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    course: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }],
    attendance: [{ date: { type: Date, required: true }, status: { type: String, required: true } }],
    role: { type: String, default: "student" }
});


const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }],
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    role: { type: String, default: "teacher" }
});

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" }
});

const courseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }]
}, { timeStamp: true });

const noticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const assignmentSchema = new mongoose.Schema({
    title: { type: String, },
    description: { type: String, },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', },
    dueDate: { type: Date, },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', },
    submissions: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        submittedAt: { type: Date, default: Date.now },
        setfile: { type: String },
        grade: { type: Number, default: null },
    }],
});

const scheduleSchema = new mongoose.Schema({
    schedule: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    location: { type: String },
    description: { type: String },
});

const checkschema = new mongoose.Schema({
    name: { type: String, required: true }
})

const Course = mongoose.model('Course', courseSchema);
const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Notice = mongoose.model('Notice', noticeSchema);
const check = mongoose.model('check', checkschema);
const Enquires = mongoose.model('enquries', Enquire);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Schedule = mongoose.model('Schedule', scheduleSchema);

//middleware authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied' });

    jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid Token' });
        req.user = user;
        next();
    });
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Permission Denied' });
        }
        next();
    };
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

//Registration
app.post('/api/signup', upload.single('profilePicture'), async (req, res) => {
    try {
        const { name, email, password, role, course, grade, age } = req.body;

        if (role === 'teacher' && !course) {
            return res.status(400).json({ message: 'Course is required for teachers' });
        }

        if (role === 'student' && (!course || !grade || !age)) {
            return res.status(400).json({ message: 'All student fields (course, grade, age) are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profilePicture = null;
        if (req.file) {
            profilePicture = `/uploads/${req.file.filename}`;
        }

        let newUser;
        let savedUser;

        if (role === 'admin') {
            newUser = new Admin({ name, email, password: hashedPassword });
            savedUser = await newUser.save();
        } else if (role === 'teacher') {
            newUser = new Teacher({ name, email, password: hashedPassword, course, profilePicture });
            savedUser = await newUser.save();
            const selectedCourse = await Course.findById(course);
            selectedCourse.teachers.push(savedUser._id);
            await selectedCourse.save();
        } else if (role === 'student') {
            newUser = new Student({ name, email, password: hashedPassword, course, grade, age, profilePicture });
            savedUser = await newUser.save();
            const selectedCourse = await Course.findById(course);
            selectedCourse.students.push(savedUser._id);
            await selectedCourse.save();
        }

        res.status(201).json(savedUser);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

//signin
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await Admin.findOne({ email }) ||
            await Teacher.findOne({ email }) ||
            await Student.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '99 years' });
        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//enquires
app.post('/api/enquires', async (req, res) => {
    const enquiredata = req.body;
    const enquire = new Enquires(enquiredata)
    const savedEnquire = await enquire.save()
    console.log('enquire details', savedEnquire)
    res.json(savedEnquire)
})

app.get('/api/enquires', async (req, res) => {
    const enquire = await Enquires.find()
    res.json(enquire)
})

app.delete('/api/enquires/:id', async (req, res) => {
    const { id } = req.params
    const enquire = await Enquires.findByIdAndDelete(id)
    res.json(enquire)
})
//user details 
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const { id, role } = req.user;

        let user;
        if (role === 'admin') {
            user = await Admin.findById(id).select('name profilePicture');
        } else if (role === 'teacher') {
            user = await Teacher.findById(id).select('name profilePicture');
        } else if (role === 'student') {
            user = await Student.findById(id).select('name profilePicture');
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//check
app.get('/api/check', async (req, res) => {
    const checks = await check.find()
    res.json(checks)
})

app.post('/api/check', async (req, res) => {
    const checkdata = req.body
    const newcheck = new check(checkdata);
    const savecheck = await newcheck.save()
    res.json(savecheck)
})

// Students
app.get('/api/students', async (req, res) => {
    try {
        const students = await Student.find().populate('course')
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('course')
        console.log(student)
        res.json(student);
    } catch (err) {
        res.status(404).json({ error: 'Student not found' });
    }
});

app.post('/api/students/:id/attendance', async (req, res) => {
    try {
        const { date, status } = req.body;
        if (!date || !status) {
            return res.status(400).json({ message: 'Date and status are required.' });
        }

        const student = await Student.findById(req.params.id);
        student.attendance.push({ date, status });
        await student.save();
        console.log("post data", student)
        res.json({ message: 'Attendance updated successfully', student });
    } catch (err) {
        console.error("post error", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params
        await Student.findByIdAndDelete(id)
            .then(result => {
                res.status(200).json(result)
                console.log('deleted items:', result)
            })
    } catch (error) {
        res.json(error)
        console.log('error is here :', error)
    }
})

app.post('/api/students', upload.single('profilePicture'), async (req, res) => {
    try {
        const studentData = req.body;
        if (req.file) studentData.profilePicture = `/uploads/${req.file.filename}`;
        const newStudent = new Student(studentData);
        const savedStudent = await newStudent.save();
        res.json(savedStudent);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// profile for student
app.get('/api/student-profile', authenticateToken, async (req, res) => {
    try {
        const { id, role } = req.user;
        if (role !== 'student') {
            return res.status(403).json({ message: 'Permission Denied' });
        }

        const student = await Student.findById(id).populate('course');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//student assignments handling
// Submit an assignment
app.post('/api/assignments/:id/submit', authenticateToken, upload.single('setfile'), async (req, res) => {
    try {
        const { studentId, grade } = req.body;
        let setfile = null;
        if (req.file) {
            setfile = `/uploads/${req.file.filename}`;
        }
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        assignment.submissions.push({ studentId, setfile, grade });
        await assignment.save();
        console.log('post summit details', assignment)
        res.status(200).json({ message: 'Submission successful', assignment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get schedule for a student
app.get('/api/schedule', authenticateToken, async (req, res) => {
    try {
        const schedules = await Schedule.find();
        res.json(schedules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers
app.get('/api/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find().populate('course')
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teachers/:id', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id).populate('course')
        res.json(teacher);
    } catch (err) {
        res.status(404).json({ error: 'Teacher not found' });
    }
});

app.delete('/api/teachers/:id', async (req, res) => {
    try {
        const { id } = req.params
        await Teacher.findByIdAndDelete(id)
            .then(result => {
                res.status(200).json(result)
                console.log('deleted items:', result)
            })
    } catch (error) {
        res.json(error)
        console.log('error is here :', error)
    }
})

// Teacher creates a schedule
app.post('/api/schedule', async (req, res) => {
    const { schedule, date, time, location, description } = req.body;
    try {
        const newSchedule = new Schedule({
            schedule,
            date,
            time,
            location,
            description,
        });

        const savedSchedule = await newSchedule.save();
        console.log("schedule data", savedSchedule)
        res.status(201).json(savedSchedule);
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message });
    }
});

//teacher attendance
app.get('/api/teacher-attendance', authenticateToken, async (req, res) => {
    try {
        const { id } = req.user;
        const teacher = await Teacher.findById(id).populate('course');
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        const teacherCourses = teacher.course.map(course => course._id);
        if (!teacherCourses.length) {
            return res.status(404).json({ message: 'No courses found for this teacher' });
        }
        const students = (await Student.find({ course: { $in: teacherCourses } }).select('name course attendance').populate('course', 'name'));
        res.status(200).json({ students });
    } catch (error) {
        console.log(error)
        console.error('Server Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


//teachers assignments handling
// Create a new assignment
app.post('/api/assignments', async (req, res) => {
    try {
        const { title, description, course, dueDate, assignedBy } = req.body;
        const newAssignment = new Assignment({ title, description, course, dueDate, assignedBy });
        await newAssignment.save();
        res.status(201).json(newAssignment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        const assignments = await Assignment.find()
            .populate('course', 'name')
            .populate('assignedBy', 'name email');
        res.status(200).json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
    const delass = await Assignment.findByIdAndDelete(req.params.id)
})

// Get a specific assignment by ID
app.get('/api/assignments/:id', authenticateToken, async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('course', 'name')
            .populate('assignedBy', 'name email')
            .populate('submissions.studentId', 'name email');

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        res.status(200).json(assignment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/assignments/:id/submissions/:submissionId', authenticateToken, async (req, res) => {
    const { id, submissionId } = req.params;
    const { grade } = req.body;

    if (!grade) {
        return res.status(400).json({ message: 'Grade is required' });
    }

    try {
        const assignment = await Assignment.findById(id);

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        const submission = assignment.submissions.id(submissionId);

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        submission.grade = grade;
        await assignment.save();

        res.status(200).json({ message: 'Grade updated successfully', submission });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
});

app.delete('/api/assignments/:id/submissions/:submissionId', authenticateToken, async (req, res) => {
    const assignment = await Assignment.findById(req.params.id)
    assignment.submissions = assignment.submissions.filter(
        (submission) => submission._id.toString() !== req.params.submissionId
    );
    assignment.save()
})

// profile for teacher
app.get('/api/teacher-profile', authenticateToken, async (req, res) => {
    try {
        const { id, role } = req.user;
        if (role !== 'teacher') {
            return res.status(403).json({ message: 'Permission Denied' });
        }

        const teacher = await Teacher.findById(id).populate('course');
        if (!teacher) {
            return res.status(404).json({ message: 'teacher not found' });
        }

        res.json(teacher);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a submission (e.g., grade the submission)
app.patch('/api/assignments/:id/submissions/:submissionId', async (req, res) => {
    try {
        const { grade } = req.body;
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        const submission = assignment.submissions.id(req.params.submissionId);

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        submission.grade = grade;
        await assignment.save();

        res.status(200).json({ message: 'Submission graded successfully', assignment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/teachers', upload.single('profilePicture'), async (req, res) => {
    try {
        const teacherData = req.body;
        if (req.file) teacherData.profilePicture = `/uploads/${req.file.filename}`;
        const newTeacher = new Teacher(teacherData);
        const savedTeacher = await newTeacher.save();
        res.json(savedTeacher);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

//chart for students
app.get('/api/students-count', async (req, res) => {
    try {
        const courses = await Course.find().populate('students', '_id');
        const studentCounts = courses.map((course) => ({
            _id: course._id,
            name: course.name,
            studentCount: course.students.length,
        }));

        res.json(studentCounts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch student counts' });
    }
});

//chart for teachers 
app.get('/api/teachers-count', async (req, res) => {
    const courses = await Course.find().populate('teachers', '_id');
    const teachercounts = courses.map((course) => ({
        _id: course._id,
        name: course.name,
        teachercount: course.teachers.length,
    }))
    res.json(teachercounts)
})

//chart for overall attendance %
app.get('/api/teacher-attendance/graph', authenticateToken, async (req, res) => {
    try {
        const { id } = req.user;
        const teacher = await Teacher.findById(id).populate('course');

        const teacherCourses = teacher.course.map(course => course._id);

        const students = await Student.find({ course: { $in: teacherCourses } })
            .select('name attendance')
            .populate('course', 'name');

        const studentAttendanceData = students.map(student => {
            const presentCount = student.attendance.filter(attendance => attendance.status.toLowerCase() === 'present').length;
            return {
                name: student.name,
                presentCount
            };
        });

        return res.json(studentAttendanceData);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});

//graph for top rank holders
app.get('/api/top-students', authenticateToken, async (req, res) => {
    try {
        const results = await Assignment.aggregate([
            { $unwind: "$submissions" },
            {
                $lookup: {
                    from: "students", // Assuming students collection
                    localField: "submissions.studentId",
                    foreignField: "_id",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            {
                $group: {
                    _id: "$student._id",
                    name: { $first: "$student.name" },
                    totalGrade: { $sum: "$submissions.grade" }
                }
            },
            { $sort: { totalGrade: -1 } }, // Sort by grades in descending order
            { $limit: 10 } // Get top 10 students
        ]);
        console.log(results)
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

//student graphs
app.get('/api/student/:id/attendance/graph', async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const attendanceStats = {
            present: 0,
            absent: 0,
            late: 0,
        };

        student.attendance.forEach((record) => {
            if (record.status === 'Present') {
                attendanceStats.present++;
            } else if (record.status === 'Absent') {
                attendanceStats.absent++;
            } else if (record.status === 'Late') {
                attendanceStats.late++;
            }
        });
        res.json(attendanceStats);
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/student/:studentId/assignments', async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const assignments = await Assignment.find({ 'submissions.studentId': studentId })
            .populate('course')
            .populate('submissions.studentId');

        const studentAssignments = assignments.map(assignment => {
            const submission = assignment.submissions.find(sub => sub.studentId._id.toString() === studentId);
            return {
                title: assignment.title,
                grade: submission ? submission.grade : null,
            };
        });
        console.log(studentAssignments)
        res.json(studentAssignments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assignments' });
    }
});

// Courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find().populate('students').populate('teachers')
        console.log(courses)
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('students')
            .populate('teachers');

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        res.json(course);
    } catch (error) {
        console.error('Error fetching course details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.delete('/api/courses/:id', async (req, res) => {
    try {
        const { id } = req.params
        await Course.findByIdAndDelete(id)
            .then(result => {
                res.status(200).json(result)
                console.log('deleted items:', result)
            })
    } catch (error) {
        res.json(error)
        console.log('error is here :', error)
    }
})

//update course for student
app.post('/api/courses/:id/students', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        const student = await Student.findById(req.body.studentId);

        if (!course || !student) {
            return res.status(404).json({ message: 'Course or student not found' });
        }

        course.students.push(student._id);
        await course.save();

        student.course = course._id;
        await student.save();

        res.json({ message: 'Student added to course successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/courses', async (req, res) => {
    try {
        const courseData = req.body;
        const newCourse = new Course(courseData);
        const savedCourse = await newCourse.save();
        res.json(savedCourse);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Notices
app.get('/api/notices', async (req, res) => {
    try {
        const notices = await Notice.find().sort({ date: -1 });
        res.json(notices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/notices/:id', async (req, res) => {
    try {
        const { id } = req.params
        await Notice.findByIdAndDelete(id)
            .then(result => {
                res.status(200).json(result)
                console.log('deleted items:', result)
            })
    } catch (error) {
        res.json(error)
        console.log('error is here :', error)
    }
})

app.post('/api/notices', async (req, res) => {
    try {
        const newNotice = new Notice(req.body);
        const savedNotice = await newNotice.save();
        res.json(savedNotice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


const frontendPath = path.join(__dirname, 'frontend', 'public');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(3001, () => console.log(`Server running on port 3001`));
