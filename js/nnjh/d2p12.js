var title = "電費";
var question = "台電依照用電度數分段收取對應的電費，如下表：<br>介於0~120度的部分，每度收取1.63元；<br>介於121~330度的部分，每度收取2.10元；<br>介於331~500度的部分，每度收取2.89元；<br>介於501~700度的部分，每度收取3.94元；<br>請設計電費計算系統，根據用電度數，計算應繳多少電費(四捨五入至整數位)。\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "155",
        output: "269",
        note: "1.63*120(120度內的費用)+2.10*35(121~330度的費用) = 269.1。四捨五入至整數後為269。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})