var title = "遊戲中，會根據積分給予不同的排位，也會根據積分與排位給予不同的金幣獎勵。  1.達到金牌分數 10000 獎金乘積 × 1.8 \n 2.達到銀牌分數 5000 獎金乘積× 1.4 \n 3. 達到銅牌分數 0 × 1";
var question = "請根據玩家積分，輸出對應的排位與應獲得的金幣數量。\n";
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
        input: "1500",
        output: "銅牌 1500",
        note: ""
    },
	{
        input: "6000",
        output: "銀牌 8400",
        note: ""
    },
	{
        input: "12000",
        output: "金牌 21600",
        note: ""
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