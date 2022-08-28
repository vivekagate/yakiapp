use std::sync::mpsc::Sender;

pub struct TaskManager {
    m_streamtasklist: Vec<Sender<String>>,
    l_streamtasklist: Vec<Sender<String>>,
    s_streamtasklist: Vec<Sender<String>>
}

pub fn intialize() -> TaskManager {
    let mtasklist = Vec::new();
    let ltasklist = Vec::new();
    let stasklist: Vec<Sender<String>> = Vec::new();
    let tm = TaskManager {
        m_streamtasklist: mtasklist,
        l_streamtasklist: ltasklist,
        s_streamtasklist: stasklist
    };
    tm
}

impl TaskManager {
    pub fn add_metrics_stream(&mut self, val: Sender<String>) {
        self.m_streamtasklist.push(val);
    }
    pub fn add_shell_stream(&mut self, val: Sender<String>) {
        self.s_streamtasklist.push(val);
    }

    pub fn send_to_shell(&self, val: &str) {
        for shell in &self.s_streamtasklist {
            let _ = shell.send(val.to_string());
        }
    }

    pub fn add_logs_stream(&mut self, val: Sender<String>) {
        self.l_streamtasklist.push(val);
    }

    pub fn stopallmstream(&mut self) {
        for tx in &self.m_streamtasklist {
            let _ = tx.send("STOP".to_string());
        }

        self.m_streamtasklist.clear();
    }

    pub fn stopalllstream(&mut self) {
        for tx in &self.l_streamtasklist {
            let _ = tx.send("STOP".to_string());
        }

        self.l_streamtasklist.clear();
    }

    pub fn stopallsstream(&mut self) {
        for tx in &self.s_streamtasklist {
            let _ = tx.send("exit\n".to_string());
        }

        self.s_streamtasklist.clear();
    }
}
