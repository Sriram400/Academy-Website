import { FaUserGraduate, FaChalkboardTeacher, FaBook, FaStickyNote } from 'react-icons/fa';
import SAttendanceGraph from './SAG';
import SAMarksGraph from './ASG';


function SDashboard() {
  
  return (
    <main className="main-dashboard">
      <div className="dashboard">
        <div className="card red">
          <div className="icon"><FaUserGraduate /></div>
          <div className="title">Assginments</div>
        </div>
        <div className="card blue">
          <div className="icon"><FaChalkboardTeacher /></div>
          <div className="title">Schedule</div>
        </div>
        <div className="card gray">
          <div className="icon"><FaBook /></div>
          <div className="title">Attendance</div>
        </div>
        <div className="card pink">
          <div className="icon"><FaStickyNote /></div>
          <div className="title">Notices</div>
        </div>
      </div>
      <section className="charts-section">
        <div className="chart">
          <h3>Attendance Performance</h3>
            <SAttendanceGraph />
        </div>
        <div className="chart">
          <h3>Top Rank Holders</h3>
           < SAMarksGraph />
        </div>
      </section>
    </main>
  );
}

export default SDashboard;
