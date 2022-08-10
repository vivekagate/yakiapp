use std::sync::mpsc::Sender;

pub struct TaskManager {
    m_streamtasklist: Vec<Sender<String>>,
    l_streamtasklist: Vec<Sender<String>>,
}

pub fn intialize() -> TaskManager {
    let mut mtasklist = Vec::new();
    let mut ltasklist = Vec::new();
    let tm = TaskManager {
        m_streamtasklist: mtasklist,
        l_streamtasklist: ltasklist,
    };
    tm
}

impl TaskManager {
    pub fn add_metrics_stream(&mut self, val: Sender<String>) {
        self.m_streamtasklist.push(val);
    }

    pub fn add_logs_stream(&mut self, val: Sender<String>) {
        self.l_streamtasklist.push(val);
    }

    pub fn stopallmstream(&mut self) {
        for tx in &self.m_streamtasklist {
            tx.send("STOP".to_string());
        }

        self.m_streamtasklist.clear();
    }

    pub fn stopalllstream(&mut self) {
        for tx in &self.l_streamtasklist {
            tx.send("STOP".to_string());
        }

        self.l_streamtasklist.clear();
    }
}
